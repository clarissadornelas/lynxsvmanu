import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const authHeader = req.headers.get('Authorization')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Supabase env missing' }, 500)
    }

    const authResult = await verifyTenantAccess(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      authHeader,
      body.tenantId,
      false,
    )

    if (!authResult.ok) {
      return jsonResponse({ error: authResult.error }, authResult.status)
    }

    const { tenantId, supabase } = authResult

    const { data: instance, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (instanceError) {
      return jsonResponse({ error: 'Database error: ' + instanceError.message }, 500)
    }

    if (!instance) {
      return jsonResponse({ status: 'disconnected' })
    }

    let status = instance.status

    const stateRes = await fetch(
      `${EVOLUTION_BASE_URL}/instance/connectionState/${instance.instance_name}`,
      {
        headers: { apikey: EVOLUTION_API_KEY },
      },
    )

    if (stateRes.ok) {
      const data = await stateRes.json()
      if (data.instance?.state === 'open') {
        status = 'connected'
      } else if (data.instance?.state === 'connecting') {
        status = 'connecting'
      } else {
        status = 'disconnected'
      }

      const { error: updateError } = await supabase
        .from('evolution_instances')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', instance.id)

      if (updateError) {
        console.error('[Status Update Error]', updateError)
      }
    }

    return jsonResponse({ status })
  } catch (error: any) {
    console.error('whatsapp-status error:', error)
    return jsonResponse({ error: error?.message ?? 'Unknown error' }, 500)
  }
})
