import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import {
  encrypt,
  decrypt,
  hasEncryptionSecret,
  getEncryptionSecretStatus,
} from '../_shared/crypto.ts'

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
          diagnostico: secretStatus,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const { data: keys, error: fetchError } = await supabase
      .from('ai_provider_keys')
      .select('id, provider, api_key_encrypted, user_id')

    if (fetchError) throw fetchError

    const results: { id: string; provider: string; status: string; error?: string }[] = []

    for (const keyRow of keys ?? []) {
      try {
        const plainKey = await decrypt(keyRow.api_key_encrypted)
        const newEncrypted = await encrypt(plainKey)

        const { error: updateError } = await supabase
          .from('ai_provider_keys')
          .update({ api_key_encrypted: newEncrypted })
          .eq('id', keyRow.id)

        if (updateError) {
          results.push({
            id: keyRow.id,
            provider: keyRow.provider,
            status: 'update_failed',
            error: updateError.message,
          })
        } else {
          results.push({ id: keyRow.id, provider: keyRow.provider, status: 're_encrypted' })
        }
      } catch (e: any) {
        results.push({
          id: keyRow.id,
          provider: keyRow.provider,
          status: 'decrypt_failed',
          error: e?.message || String(e),
        })
      }
    }

    const summary = {
      total: results.length,
      re_encrypted: results.filter((r) => r.status === 're_encrypted').length,
      failed: results.filter((r) => r.status !== 're_encrypted').length,
      details: results,
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
