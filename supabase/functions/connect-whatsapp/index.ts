import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { configureWebhook } from '../_shared/webhook.ts'
import { verifyTenantAccess } from '../_shared/tenant-auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? ''
const EVOLUTION_BASE_URL = Deno.env.get('EVOLUTION_BASE_URL') ?? ''

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function safeText(res: Response) {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

async function getConnectionState(instanceName: string) {
  const res = await fetch(`${EVOLUTION_BASE_URL}/instance/connectionState/${instanceName}`, {
    method: 'GET',
    headers: { apikey: EVOLUTION_API_KEY },
  })
  if (!res.ok) return { ok: false, state: null as string | null, raw: await safeText(res) }
  const data = await res.json().catch(() => ({}))
  const state =
    data?.instance?.state || data?.state || data?.instance?.status || data?.status || null
  return { ok: true, state, raw: data }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const authHeader = req.headers.get('Authorization')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Supabase env missing' }, 500)
    }
    if (!EVOLUTION_BASE_URL || !EVOLUTION_API_KEY) {
      return jsonResponse({ error: 'Evolution API configuration missing' }, 500)
    }

    const authResult = await verifyTenantAccess(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      authHeader,
      body.tenantId,
      true,
    )

    if (!authResult.ok) {
      return jsonResponse({ error: authResult.error }, authResult.status)
    }

    const { user, tenantId, supabase } = authResult
    const instanceName = `tenant_${tenantId!.replace(/-/g, '')}`

    const { error: upsertError } = await supabase.from('evolution_instances').upsert(
      {
        tenant_id: tenantId,
        user_id: user.id,
        instance_name: instanceName,
        status: 'connecting',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' },
    )

    if (upsertError) {
      return jsonResponse({ error: 'Database error: ' + upsertError.message }, 500)
    }

    let qr: string | null = null
    let status: 'connecting' | 'qrcode' | 'connected' = 'connecting'
    let isWebhookEnabled = false

    const createRes = await fetch(`${EVOLUTION_BASE_URL}/instance/create`, {
      method: 'POST',
      headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    })

    if (createRes.ok) {
      const data = await createRes.json().catch(() => ({}))
      qr = data?.qrcode?.base64 ?? null
      const state = data?.instance?.state || data?.instance?.status || data?.state || data?.status
      if (qr) status = 'qrcode'
      else if (state === 'open' || state === 'connected') status = 'connected'
    } else {
      console.log('[Instance Create] non-ok:', createRes.status, await safeText(createRes))
    }

    if (status === 'connecting') {
      const connectRes = await fetch(`${EVOLUTION_BASE_URL}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: { apikey: EVOLUTION_API_KEY },
      })

      if (connectRes.ok) {
        const data = await connectRes.json().catch(() => ({}))
        qr = data?.base64 ?? data?.qrcode?.base64 ?? null
        const state = data?.instance?.state || data?.instance?.status || data?.state || data?.status
        if (qr) status = 'qrcode'
        else if (state === 'open' || state === 'connected') status = 'connected'
      } else {
        console.log('[Instance Connect] non-ok:', connectRes.status, await safeText(connectRes))
      }
    }

    if (status === 'connecting') {
      const st = await getConnectionState(instanceName)
      if (st.ok) {
        if (st.state === 'open' || st.state === 'connected') status = 'connected'
      } else {
        console.log('[ConnectionState] non-ok:', st.raw)
      }
    }

    if (status === 'qrcode' || status === 'connected') {
      try {
        isWebhookEnabled = await configureWebhook(
          instanceName,
          SUPABASE_URL,
          EVOLUTION_BASE_URL,
          EVOLUTION_API_KEY,
          EVOLUTION_API_KEY,
        )
      } catch (webhookError) {
        console.error('[Webhook Config] Exception:', webhookError)
      }
    } else {
      console.log(`[Webhook Config] Skipped because instance is not ready. Status: ${status}`)
    }

    const { error: updateError } = await supabase
      .from('evolution_instances')
      .update({
        status,
        is_webhook_enabled: isWebhookEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)

    if (updateError) {
      console.error('[DB Update Error]', updateError)
    }

    return jsonResponse({ instanceName, status, qr, isWebhookEnabled })
  } catch (error: any) {
    console.error('connect-whatsapp error:', error)
    return jsonResponse({ error: error?.message ?? 'Unknown error' }, 500)
  }
})
