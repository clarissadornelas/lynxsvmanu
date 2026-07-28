import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { encrypt, hasEncryptionSecret, getEncryptionSecretStatus } from '../_shared/crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    if (!hasEncryptionSecret()) {
      const secretStatus = getEncryptionSecretStatus()
      return new Response(
        JSON.stringify({
          error: 'Erro de configuração: Segredo de criptografia não encontrado no servidor.',
          diagnostico: {
            ...secretStatus,
            hint: 'Configure a variável ENCRYPTION_SECRET nas configurações do Supabase Edge Functions.',
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const { tenantId, provider, apiKey } = await req.json()

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Empresa não informada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!provider || !apiKey) {
      throw new Error('Provider and API Key are required')
    }

    const { data: usuarioData, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id, ativo, papel')
      .eq('tenant_id', tenantId)
      .eq('email', user.email!)
      .maybeSingle()

    if (usuarioError) throw usuarioError

    if (!usuarioData || !usuarioData.ativo) {
      return new Response(
        JSON.stringify({ error: 'Você não tem vínculo ativo com esta empresa.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (usuarioData.papel !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Apenas o administrador da empresa pode salvar a chave de IA.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const encryptedKey = await encrypt(apiKey)

    const { error: upsertError } = await supabase.from('ai_provider_keys').upsert(
      {
        tenant_id: tenantId,
        user_id: user.id,
        provider,
        api_key_encrypted: encryptedKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,provider' },
    )

    if (upsertError) throw upsertError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
