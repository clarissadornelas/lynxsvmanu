// LAB DRY-RUN: Esta função é parte do banco de testes de entrevistas ("Lynxs").
// Processa transcrição de áudio em memória via Whisper API sem persistir dados no banco.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decrypt, hasEncryptionSecret } from '../_shared/crypto.ts'

const MAX_FILE_SIZE = 24 * 1024 * 1024

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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

    const formData = await req.formData()
    const tenantId = formData.get('tenantId') as string
    const speaker = (formData.get('speaker') as string) || ''
    const rawFile = formData.get('file')

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Empresa não informada' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    if (!rawFile || !(rawFile instanceof File) || rawFile.size === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma faixa de áudio recebida' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const file = rawFile as File

    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Faixa acima de 24 MB. Grave um teste mais curto.' }),
        { status: 413, headers: jsonHeaders },
      )
    }

    let usuarioAtivo = false
    try {
      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id, ativo')
        .eq('tenant_id', tenantId)
        .eq('email', user.email!)
        .maybeSingle()

      if (usuarioError) throw usuarioError
      usuarioAtivo = !!usuarioData?.ativo
    } catch (e: any) {
      return new Response(
        JSON.stringify({ error: e.message || 'Erro ao verificar vínculo com a empresa' }),
        { status: 500, headers: jsonHeaders },
      )
    }

    if (!usuarioAtivo) {
      return new Response(JSON.stringify({ error: 'Sem vínculo ativo com esta empresa' }), {
        status: 403,
        headers: jsonHeaders,
      })
    }

    let apiKey = ''
    try {
      const { data: keyData, error: keyError } = await supabase
        .from('ai_provider_keys')
        .select('api_key_encrypted')
        .eq('tenant_id', tenantId)
        .eq('provider', 'openai')
        .maybeSingle()

      if (keyError) throw keyError

      if (!keyData?.api_key_encrypted) {
        return new Response(
          JSON.stringify({ error: 'A empresa ainda não tem chave de IA configurada' }),
          { status: 400, headers: jsonHeaders },
        )
      }

      if (!hasEncryptionSecret()) {
        return new Response(
          JSON.stringify({
            error: 'Falha ao decifrar a chave de IA. Re-salve a chave em Configurações.',
          }),
          { status: 500, headers: jsonHeaders },
        )
      }

      try {
        apiKey = await decrypt(keyData.api_key_encrypted)
      } catch {
        return new Response(
          JSON.stringify({
            error: 'Falha ao decifrar a chave de IA. Re-salve a chave em Configurações.',
          }),
          { status: 500, headers: jsonHeaders },
        )
      }
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || 'Erro ao buscar chave de IA' }), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    const whisperForm = new FormData()
    whisperForm.append('file', file, file.name || 'audio.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'pt')
    whisperForm.append('response_format', 'verbose_json')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    })

    if (!whisperRes.ok) {
      const errBody = await whisperRes.text()
      return new Response(
        JSON.stringify({
          error: `Whisper API error (status ${whisperRes.status}): ${errBody.substring(0, 300)}`,
        }),
        { status: 502, headers: jsonHeaders },
      )
    }

    const whisperData = await whisperRes.json()

    const segments = (whisperData.segments || [])
      .map((seg: any) => ({
        start: seg.start ?? 0,
        text: (seg.text || '').trim(),
      }))
      .filter((seg: { start: number; text: string }) => seg.text.length > 0)

    const response: Record<string, unknown> = {
      speaker,
      segments,
    }

    if (typeof whisperData.duration === 'number') {
      response.duration = whisperData.duration
    }

    return new Response(JSON.stringify(response), { status: 200, headers: jsonHeaders })
  } catch (error: any) {
    console.error('lab-transcribe-audio error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
