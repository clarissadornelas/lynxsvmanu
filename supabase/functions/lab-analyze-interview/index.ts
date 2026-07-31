import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decrypt, hasEncryptionSecret } from '../_shared/crypto.ts'
import OpenAI from 'npm:openai@4.52.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Não autorizado')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Não autorizado')

    const body = await req.json()
    const { entrevista_id, transcricao, vaga_id, cargo, descricao_vaga } = body

    let transcriptText = transcricao ?? ''
    let vagaTitulo = cargo ?? ''
    let vagaDescricao = descricao_vaga ?? ''
    let candidatoNome: string | undefined
    let entTenantId: string | undefined
    let entVagaId: string | undefined
    let entCandidatoId: string | undefined

    if (!transcriptText && entrevista_id) {
      const { data: ent, error: entErr } = await supabase
        .from('entrevistas')
        .select('transcricao, roteiro, vaga_id, candidato_id, tenant_id')
        .eq('id', entrevista_id)
        .maybeSingle()

      if (entErr || !ent) throw new Error('Entrevista não encontrada')
      transcriptText = ent.transcricao ?? ''
      entVagaId = ent.vaga_id
      entCandidatoId = ent.candidato_id
      entTenantId = ent.tenant_id

      if (!transcriptText) {
        throw new Error('Transcrição não encontrada. Salve a transcrição antes de analisar.')
      }
    }

    if (!vagaTitulo && (vaga_id ?? entVagaId)) {
      const { data: vaga } = await supabase
        .from('vagas')
        .select('titulo, descricao')
        .eq('id', vaga_id ?? entVagaId)
        .maybeSingle()
      if (vaga) {
        vagaTitulo = vaga.titulo ?? vagaTitulo
        vagaDescricao = vaga.descricao ?? vagaDescricao
      }
    }

    if (entCandidatoId) {
      const { data: cand } = await supabase
        .from('candidatos')
        .select('nome, score')
        .eq('id', entCandidatoId)
        .maybeSingle()
      candidatoNome = cand?.nome
    }

    const tenantForKeys = entTenantId ?? user.id

    const { data: keyData } = await supabase
      .from('ai_provider_keys')
      .select('api_key_encrypted')
      .eq('tenant_id', tenantForKeys)
      .eq('provider', 'openai')
      .maybeSingle()

    if (!keyData?.api_key_encrypted) {
      throw new Error(
        'Esta empresa ainda não tem chave de IA configurada. Peça ao administrador para configurar em Configurações.',
      )
    }

    if (!hasEncryptionSecret()) {
      console.error('ENCRYPTION_SECRET is not configured on the server')
      throw new Error(
        'Configuração de segurança ausente: ENCRYPTION_SECRET não definido no servidor.',
      )
    }

    let apiKey = ''
    try {
      apiKey = await decrypt(keyData.api_key_encrypted)
    } catch (e) {
      console.error('Decrypt error:', e)
      throw new Error('Falha ao descriptografar a chave de IA. Verifique a configuração do ENCRYPTION_SECRET.')
    }

    if (!apiKey) {
      throw new Error('Chave de IA inválida após descriptografia.')
    }

    const promptVaga = `Vaga: ${vagaTitulo || 'N/A'}\nDescrição: ${vagaDescricao?.substring(0, 2000) || 'N/A'}\nCandidato: ${candidatoNome || 'N/A'}`
    const transcript = transcriptText.substring(0, 15000)

    const openai = new OpenAI({ apiKey })
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    let completion
    try {
      completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                `You are an expert HR analyst. Analyze the interview transcript and provide a comprehensive assessment in Brazilian Portuguese.

Output ONLY a valid JSON object with this schema:
{
  "disc": {
    "profile": "string - perfil DISC de 2 letras (ex: DI, SC, DC, IS, CS)",
    "D": number 0-100,
    "I": number 0-100,
    "S": number 0-100,
    "C": number 0-100,
    "confidence": number 0-1
  },
  "relatorio": {
    "executive_summary": "string - resumo executivo de 3-5 frases",
    "description": "string - descrição detalhada pós-entrevista do perfil comportamental",
    "recommendation": "Aprovado" | "Em Análise" | "Reprovado",
    "strengths": ["string - pontos fortes observados na entrevista"],
    "risks": ["string - pontos de atenção ou riscos"],
    "next_steps": "string - próximos passos sugeridos"
  },
  "competencyMatch": {
    "score": number 0-100,
    "matched": ["string - competências alinhadas à vaga"],
    "gaps": ["string - competências que precisam de desenvolvimento"],
    "observacao": "string - análise geral do match"
  },
  "speechConsistency": {
    "score": number 0-100,
    "clareza": "string - avaliação da clareza",
    "coerencia": "string - avaliação da coerência",
    "objetividade": "string - avaliação da objetividade"
  },
  "score_simulado": number 0-100,
  "score_obs": "string - justificativa detalhada do score (2-4 frases)"
}

Analyze the candidate's speech patterns, answers, and behavior indicators from the transcript. All content must be in Brazilian Portuguese.`,
            },
            {
              role: 'user',
              content: `${promptVaga}\n\nTranscrição da entrevista:\n${transcript}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        },
        { signal: controller.signal },
      )
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Tempo limite excedido: a IA não respondeu em 30 segundos.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      throw e
    } finally {
      clearTimeout(timeoutId)
    }

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    return new Response(
      JSON.stringify({
        dry_run: true,
        ...result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const status = error.message === 'Não autorizado' ? 401 : 500
    console.error('lab-analyze-interview error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
