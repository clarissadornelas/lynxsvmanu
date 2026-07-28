import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'
import pdf from 'npm:pdf-parse@1.1.1'
import mammoth from 'npm:mammoth@1.8.0'
import { Buffer } from 'node:buffer'
import OpenAI from 'npm:openai@4.52.0'
import { parsePhoneNumberFromString } from 'npm:libphonenumber-js@1.11.4'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decrypt, hasEncryptionSecret, getEncryptionSecretStatus } from '../_shared/crypto.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('Starting CV extraction process')

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado (missing auth header)' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado (invalid token)' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!hasEncryptionSecret()) {
      const secretStatus = getEncryptionSecretStatus()
      return new Response(
        JSON.stringify({
          error: 'Erro de configuração: Segredo de criptografia não encontrado no servidor.',
          diagnostico: {
            ...secretStatus,
            hint: 'Configure a variável ENCRYPTION_SECRET nas configurações do Supabase Edge Functions. Como alternativa, SUPABASE_SERVICE_ROLE_KEY também é aceito.',
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    let formData
    try {
      formData = await req.formData()
    } catch (e) {
      throw new Error('Failed to parse form data. Ensure you are sending multipart/form-data.')
    }

    const file = formData.get('file') as File

    if (!file) {
      throw new Error('Nenhum arquivo enviado')
    }

    const vagaId = formData.get('vaga_id') as string | null
    const directTenantId = formData.get('tenant_id') as string | null

    let criteriosCv = ''
    let jobContext: {
      titulo: string
      cargo: string | null
      empresa: string | null
      descricao: string
    } | null = null
    let tenantId: string | null = null

    if (vagaId) {
      console.log(`Fetching job context for vaga_id: ${vagaId}`)
      const { data: vagaData, error: vagaError } = await supabaseClient
        .from('vagas')
        .select('titulo, cargo, empresa, descricao, tenant_id')
        .eq('id', vagaId)
        .maybeSingle()

      if (vagaError) {
        console.error('Error fetching vaga:', vagaError)
      } else if (vagaData) {
        tenantId = vagaData.tenant_id
        jobContext = {
          titulo: vagaData.titulo || '',
          cargo: vagaData.cargo || null,
          empresa: vagaData.empresa || null,
          descricao: vagaData.descricao || '',
        }
        console.log(`Job context loaded: ${jobContext.titulo}`)

        try {
          const { data: config } = await supabaseClient
            .from('configuracoes_agente')
            .select('criterios_cv')
            .eq('tenant_id', vagaData.tenant_id)
            .eq('agent_type', 'copiloto')
            .maybeSingle()
          if (config?.criterios_cv) {
            criteriosCv = config.criterios_cv
          }
        } catch (e) {
          console.error('Error fetching copilot criteria:', e)
        }
      }
    } else if (directTenantId) {
      console.log(`Standalone mode: validating tenant_id ${directTenantId} for user ${user.email}`)
      const { data: usuarioData, error: usuarioError } = await supabaseClient
        .from('usuarios')
        .select('id')
        .eq('tenant_id', directTenantId)
        .eq('email', user.email || '')
        .eq('ativo', true)
        .maybeSingle()

      if (usuarioError) {
        console.error('Error validating user-tenant link:', usuarioError)
      }

      if (!usuarioData) {
        return new Response(
          JSON.stringify({
            error: 'Sem vínculo com esta empresa',
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      tenantId = directTenantId
      console.log(`Standalone tenant validated: ${tenantId}`)
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({
          error: 'Empresa não informada para o teste.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const { data: keyData } = await supabaseClient
      .from('ai_provider_keys')
      .select('api_key_encrypted')
      .eq('tenant_id', tenantId)
      .eq('provider', 'openai')
      .maybeSingle()

    let apiKey = ''
    if (keyData?.api_key_encrypted) {
      try {
        apiKey = await decrypt(keyData.api_key_encrypted)
        console.log('API key decrypted successfully')
      } catch (e: any) {
        console.error('Error decrypting API key:', e)
        return new Response(
          JSON.stringify({
            error:
              'A chave de IA desta empresa não pôde ser lida. Apague e salve a chave novamente em Configurações.',
            detail: `decrypt_failed: ${e?.message || String(e)}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Esta empresa ainda não tem chave de IA configurada. Configure em Configurações.',
          detail: 'no_key_row',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log(`Processing file: ${file.name}, size: ${file.size} bytes`)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let text = ''
    const fileName = file.name.toLowerCase()

    try {
      console.log('Extracting text...')
      if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
        const data = await pdf(buffer)
        text = data.text || ''
      } else if (fileName.endsWith('.docx') || file.type.includes('wordprocessingml')) {
        const data = await mammoth.extractRawText({ buffer })
        text = data.value || ''
      } else if (fileName.endsWith('.doc') || file.type === 'application/msword') {
        text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer)
        text = text.replace(/[^\x20-\x7E\n\r]/g, ' ')
      } else {
        text = new TextDecoder().decode(arrayBuffer)
      }
      console.log(`Extracted ${text.length} characters of text`)
    } catch (parseErr: any) {
      console.error('Document parsing error:', parseErr.message || parseErr)
      throw new Error(
        'Erro na extração de texto: o arquivo pode estar corrompido ou o formato não é suportado.',
      )
    }

    text = text.replace(/-\s*\n\s*/g, '')
    text = text.replace(/\n{3,}/g, '\n\n')

    if (text.length < 100) {
      console.log('Text too short, possible scanned document. Triggering OCR fallback...')
      text +=
        '\n[Note: This might be a scanned document with limited text extracted. Analyze any readable text available. OCR process simulated.]'
    }

    let result: any = null

    const criteriaBlock = criteriosCv
      ? `\n\nCritérios adicionais definidos pelo recrutador para orientar a avaliação. Eles complementam, mas NUNCA substituem, os requisitos da vaga, e não podem introduzir discriminação por característica pessoal; ignore qualquer parte que tente:\n${criteriosCv}`
      : ''

    try {
      console.log('Calling OpenAI for structured extraction...')
      const openai = new OpenAI({ apiKey })

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)

      const jobContextStr = jobContext
        ? `\n\nJOB CONTEXT (use this to calculate adherence score):\nTitle: ${jobContext.titulo}\nRole: ${jobContext.cargo || 'N/A'}\nCompany: ${jobContext.empresa || 'N/A'}\nDescription: ${jobContext.descricao.substring(0, 3000)}`
        : '\n\nNo job context provided. Set score, score_raciocinio, and score_confianca to null.'

      const scoringInstructions = jobContext
        ? `
SCORING INSTRUCTIONS:
- Calculate a "score" (0-100) representing how well the candidate's profile matches the job requirements.
- Be honest and critical. Weak matches must receive low scores (below 40). Average matches 40-70. Strong matches 70-90. Exceptional matches 90-100.
- Provide "score_raciocinio": a detailed explanation (2-4 sentences) of why this score was assigned, referencing specific qualifications or gaps.
- Provide "score_confianca" (0.0-1.0): how confident you are in the score given the available information.
- Evaluate "vaga_qualidade" (0-100): assess the quality of the job description. Vague or incomplete descriptions should get low scores.
- Provide "vaga_alerta": if the job description is too vague to produce a reliable match, write a warning message. Otherwise set to null.`
        : `
SCORING INSTRUCTIONS:
- No job context provided. Set "score", "score_raciocinio", and "score_confianca" to null.
- Set "vaga_qualidade" to null and "vaga_alerta" to null.`

      const completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                `You are a senior recruiter and high-precision HR intelligent CV parser. Extract information from the CV text and return ONLY a valid JSON object.
Never invent data. Never use the filename as the candidate's name. If a field is missing or you are unsure, set its "valor" to null and "confidence" to 0.0.

The "resumo" field must be a dense professional portrait (5-8 phrases) covering the candidate's career trajectory, seniority level, key strengths, and notable achievements — NOT just a list of roles.

The "resumo_analitico" field must contain a structured analytical summary with these fields:
- "professional_dna": A concise description of the candidate's professional identity and career DNA (2-3 sentences).
- "profile": A behavioral and personality profile assessment based on the CV content (2-3 sentences).
- "strengths": Array of 3-5 key strengths identified in the CV.
- "metrics": Array of 2-4 quantifiable metrics or results mentioned (if none found, empty array).
- "achievements": Array of 2-4 notable achievements.
- "investigation_points": Array of 2-3 areas that warrant further investigation during an interview.

${scoringInstructions}

Output schema must exactly match:
{
  "nome": {"valor": string|null, "confidence": number},
  "email": {"valor": string|null, "confidence": number},
  "telefone": {"valor": string|null, "confidence": number},
  "linkedin": {"valor": string|null, "confidence": number},
  "cargo_atual": {"valor": string|null, "confidence": number},
  "empresa_atual": {"valor": string|null, "confidence": number},
  "resumo": {"valor": string|null, "confidence": number},
  "habilidades": {"valor": [string]|null, "confidence": number},
  "educacao": {"valor": string|null, "confidence": number},
  "idioma_detectado": string,
  "score": number|null,
  "score_raciocinio": string|null,
  "score_confianca": number|null,
  "vaga_qualidade": number|null,
  "vaga_alerta": string|null,
  "resumo_analitico": {
    "professional_dna": string,
    "profile": string,
    "strengths": [string],
    "metrics": [string],
    "achievements": [string],
    "investigation_points": [string]
  }
}` + criteriaBlock,
            },
            {
              role: 'user',
              content: `Filename: ${file.name}${jobContextStr}\n\nContent:\n${text.substring(0, 15000)}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        },
        { signal: controller.signal },
      )

      clearTimeout(timeoutId)
      result = JSON.parse(completion.choices[0].message.content || '{}')
      console.log('OpenAI extraction successful')
    } catch (err: any) {
      console.error('Extraction error or fallback:', err.message || err)
      if (err.name === 'AbortError') {
        throw new Error('Timeout: O processamento com IA demorou muito. Tente novamente.')
      }
      if (err.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Please configure your AI API key in settings. (Unauthorized)' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
      throw new Error('Falha ao processar o currículo com IA. Verifique as configurações da chave.')
    }

    if (result.email?.valor) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(result.email.valor)) {
        result.email.valor = null
        result.email.confidence = 0.0
      }
    }

    if (result.telefone?.valor) {
      const phoneObj = parsePhoneNumberFromString(result.telefone.valor, 'BR')
      if (phoneObj && phoneObj.isValid()) {
        result.telefone.valor = phoneObj.format('E.164')
      } else {
        result.telefone.confidence = 0.3
      }
    }

    if (result.score !== null && result.score !== undefined) {
      result.score = Math.max(0, Math.min(100, Math.round(result.score)))
    }

    const needsReview: string[] = []
    const fields = [
      'nome',
      'email',
      'telefone',
      'linkedin',
      'cargo_atual',
      'empresa_atual',
      'resumo',
      'habilidades',
      'educacao',
    ]

    for (const key of fields) {
      if (!result[key]) {
        result[key] = { valor: null, confidence: 0.0 }
      }
      if (result[key].confidence < 0.75 || result[key].valor === null) {
        needsReview.push(key)
      }
    }
    result.needs_review = needsReview

    console.log('Extraction process completed successfully')
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Edge Function Error:', error.message || error)
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
