import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Expected JSON payload from Zapier/Make:
    // { "action": "import", "tenant_id": "...", "candidatos": [{ "nome": "...", "telefone": "...", "email": "...", "nicho": "...", "nivel": "..." }] }
    if (body.action === 'import' && body.tenant_id && Array.isArray(body.candidatos)) {
      const records = body.candidatos
        .map((c: any) => ({
          tenant_id: body.tenant_id,
          nome: c.nome,
          telefone: c.telefone,
          email: c.email,
          nicho: c.nicho,
          mercado: c.mercado,
          nivel: c.nivel,
          origem: 'webhook_integration',
        }))
        .filter((c: any) => c.telefone)

      const { error } = await supabase
        .from('base_ativa')
        .upsert(records, { onConflict: 'tenant_id,telefone' })
      if (error) throw error

      return new Response(JSON.stringify({ success: true, count: records.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid payload structure' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
