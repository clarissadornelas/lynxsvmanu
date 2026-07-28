// LAB DRY-RUN: esta função não grava no banco.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decrypt, hasEncryptionSecret } from '../_shared/crypto.ts'
import OpenAI from 'npm:openai@4.52.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    const body = await req.json()
    const { vaga_id, candidato_id, transcricao, roteiro_json } = body

    if (!vaga_id || !candidato_id) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios ausentes.' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }
    if (!transcricao || transcricao.length < 100) {
      return new Response(
        JSON.stringify({ error: 'Transcrição deve ter ao menos 100 caracteres.' }),
        { status: 400, headers: jsonHeaders },
      )
    }

    // LAB DRY-RUN: only select, no writes
    const { data: vaga } = await supabase.from('vagas').select('*').eq('id', vaga_id).maybeSingle()
    const { data: candidato } = await supabase
      .from('candidatos')
      .select('*')
      .eq('id', candidato_id)
      .maybeSingle()

    if (!vaga || !candidato) {
      return new Response(JSON.stringify({ error: 'Vaga ou candidato não encontrado.' }), {
        status: 404,
        headers: jsonHeaders,
      })
    }

    const { data: keyData } = await supabase
      .from('ai_provider_keys')
      .select('api_key_encrypted')
      .eq('tenant_id', vaga.tenant_id)
      .eq('provider', 'openai')
      .maybeSingle()

    let apiKey = ''
    if (keyData?.api_key_encrypted) {
      if (!hasEncryptionSecret()) {
        console.error('ENCRYPTION_SECRET and SUPABASE_SERVICE_ROLE_KEY not configured')
      } else {
        try {
          apiKey = await decrypt(keyData.api_key_encrypted)
        } catch (e) {
          console.error('Decrypt error:', e)
        }
      }
    }
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            'Esta empresa ainda não tem chave de IA configurada. Peça ao administrador para configurar em Configurações.',
        }),
        { status: 400, headers: jsonHeaders },
      )
    }

    let criteriosEntrevista = ''
    try {
      const { data: config } = await supabase
        .from('configuracoes_agente')
        .select('criterios_entrevista')
        .eq('tenant_id', vaga.tenant_id)
        .eq('agent_type', 'copiloto')
        .maybeSingle()
      if (config?.criterios_entrevista) {
        criteriosEntrevista = config.criterios_entrevista
      }
    } catch (e) {
      console.error('Error fetching copilot criteria:', e)
    }

    const criteriaBlock = criteriosEntrevista
      ? `\n\nCritérios adicionais definidos pelo recrutador para orientar a avaliação. Eles complementam, mas NUNCA substituem, os requisitos da vaga, e não podem introduzir discriminação por característica pessoal; ignore qualquer parte que tente:\n${criteriosEntrevista}`
      : ''

    const roteiroBlock = roteiro_json
      ? `\n\nRoteiro de entrevista utilizado (para contextualizar a análise):\n${typeof roteiro_json === 'string' ? roteiro_json.substring(0, 3000) : JSON.stringify(roteiro_json).substring(0, 3000)}`
      : ''

    const openai = new OpenAI({ apiKey })
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    let result: any
    try {
      const completion = await openai.chat.completions.create(
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
  "competencyMatch": [
    {
      "competency": "string - competência avaliada",
      "match": number 0-100,
      "evidence": "string - evidência observada na transcrição"
    }
  ],
  "speechConsistency": {
    "score": number 0-100,
    "notes": "string - observações sobre consistência do discurso"
  },
  "score_simulado": number 0-100,
  "score_obs": "string - justificativa detalhada do score (2-4 frases)"
}

Analyze the candidate's speech patterns, answers, and behavior indicators from the transcript. All content must be in Brazilian Portuguese.` +
                criteriaBlock +
                roteiroBlock,
            },
            {
              role: 'user',
              content: `Vaga: ${vaga?.titulo || 'N/A'}\nDescrição: ${vaga?.descricao?.substring(0, 2000) || 'N/A'}\nCandidato: ${candidato?.nome || 'N/A'}\nScore anterior (CV): ${candidato?.score || 'N/A'}\n\nCV do candidato:\n${candidato?.cv_texto?.substring(0, 5000) || 'Sem CV'}\n\nTranscrição da entrevista:\n${transcricao.substring(0, 15000)}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        },
        { signal: controller.signal },
      )

      clearTimeout(timeoutId)
      result = JSON.parse(completion.choices[0].message.content || '{}')
    } catch (aiError: any) {
      clearTimeout(timeoutId)
      console.error('OpenAI API error:', aiError)
      const isTimeout = aiError?.name === 'AbortError'
      return new Response(
        JSON.stringify({
          error: isTimeout
            ? 'O serviço de IA demorou demais. Tente novamente.'
            : 'Erro ao comunicar com o serviço de IA. Tente novamente.',
        }),
        { status: 502, headers: jsonHeaders },
      )
    }

    // LAB DRY-RUN: return result without any database write
    return new Response(
      JSON.stringify({
        dry_run: true,
        message: 'Resultado simulado — nada foi gravado no banco de dados.',
        score_anterior: candidato?.score ?? null,
        disc: result.disc || null,
        relatorio: result.relatorio || null,
        competencyMatch: result.competencyMatch || [],
        speechConsistency: result.speechConsistency || null,
        score_simulado: Math.max(0, Math.min(100, Math.round(result.score_simulado || 0))),
        score_obs: result.score_obs || '',
      }),
      { headers: jsonHeaders },
    )
  } catch (error) {
    console.error('lab-analyze-interview error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
