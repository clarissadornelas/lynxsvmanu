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
    const { candidateId, baseId, phone, message, contexto } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    let tenantIdToUse = null

    if (candidateId) {
      const { data: cand, error: candErr } = await supabase
        .from('candidatos')
        .select('tenant_id')
        .eq('id', candidateId)
        .single()
      if (candErr)
        console.error('[send-whatsapp-message] Error fetching candidato:', candErr.message)
      if (cand) tenantIdToUse = cand.tenant_id
    }
    if (!tenantIdToUse && baseId) {
      const { data: base, error: baseErr } = await supabase
        .from('base_ativa')
        .select('tenant_id')
        .eq('id', baseId)
        .single()
      if (baseErr)
        console.error('[send-whatsapp-message] Error fetching base_ativa by id:', baseErr.message)
      if (base) tenantIdToUse = base.tenant_id
    }
    if (!tenantIdToUse && phone) {
      const { data: base, error: baseErr } = await supabase
        .from('base_ativa')
        .select('tenant_id')
        .eq('telefone', phone)
        .limit(1)
        .single()
      if (baseErr)
        console.error(
          '[send-whatsapp-message] Error fetching base_ativa by phone:',
          baseErr.message,
        )
      if (base) tenantIdToUse = base.tenant_id
      const { data: cand, error: candErr } = await supabase
        .from('candidatos')
        .select('tenant_id')
        .eq('telefone', phone)
        .limit(1)
        .single()
      if (candErr)
        console.error('[send-whatsapp-message] Error fetching candidato by phone:', candErr.message)
      if (cand) tenantIdToUse = cand.tenant_id
    }

    if (!tenantIdToUse) throw new Error('Recipient not found in any tenant')

    // Logging logic
    let conversaQuery = supabase.from('conversas').select('id')
    if (candidateId) conversaQuery = conversaQuery.eq('candidato_id', candidateId)
    else if (baseId) conversaQuery = conversaQuery.eq('contato_id', baseId)
    else
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    let { data: conversa, error: conversaErr } = await conversaQuery.limit(1).single()
    if (conversaErr)
      console.error('[send-whatsapp-message] Error fetching conversa:', conversaErr.message)

    if (!conversa && (candidateId || baseId)) {
      const { data: newConversa, error: insertErr } = await supabase
        .from('conversas')
        .insert({
          tenant_id: tenantIdToUse,
          candidato_id: candidateId || null,
          contato_id: baseId || null,
          contexto: contexto === 'follow_up' ? 'follow_up' : 'assessor',
          estado: 'em_conversa',
        })
        .select()
        .single()
      if (insertErr)
        console.error('[send-whatsapp-message] Error inserting conversa:', insertErr.message)
      conversa = newConversa
    }

    if (conversa) {
      const { error: msgErr } = await supabase.from('mensagens').insert({
        conversa_id: conversa.id,
        direcao: 'saida',
        conteudo: message,
        status: 'enviada',
      })
      if (msgErr) console.error('[send-whatsapp-message] Error inserting mensagem:', msgErr.message)
    }

    console.log(`Sending to ${phone}: ${message}`)

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
