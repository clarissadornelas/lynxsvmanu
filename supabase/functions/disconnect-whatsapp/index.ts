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
      true,
    )

    if (!authResult.ok) {
      return jsonResponse({ error: authResult.error }, authResult.status)
    }

    const { tenantId, supabase } = authResult

    const { data: instance, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('instance_name')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (instanceError) {
      return jsonResponse({ error: 'Database error: ' + instanceError.message }, 500)
    }

    if (instance) {
      const instanceName = instance.instance_name

      try {
        await fetch(`${EVOLUTION_BASE_URL}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers: { apikey: EVOLUTION_API_KEY },
        })
      } catch (err) {
        console.error('Error logging out from Evolution API:', err)
      }

      try {
        await fetch(`${EVOLUTION_BASE_URL}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: { apikey: EVOLUTION_API_KEY },
        })
      } catch (err) {
        console.error('Error deleting instance from Evolution API:', err)
      }

      const { error: deleteError } = await supabase
        .from('evolution_instances')
        .delete()
        .eq('tenant_id', tenantId)

      if (deleteError) {
        return jsonResponse({ error: 'Database deletion failed: ' + deleteError.message }, 500)
      }
    }

    return jsonResponse({ success: true })
  } catch (error: any) {
    console.error('Disconnect error:', error)
    return jsonResponse({ error: error?.message ?? 'Unknown error' }, 500)
  }
})
