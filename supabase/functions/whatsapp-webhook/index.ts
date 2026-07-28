import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

function generatePhoneVariants(phone: string): string[] {
  const variants = new Set<string>([phone])
  if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) {
    const withoutCC = phone.substring(2)
    variants.add(withoutCC)
    const ddd = withoutCC.substring(0, 2)
    const rest = withoutCC.substring(2)
    if (phone.length === 13 && rest.startsWith('9') && rest.length === 9) {
      const without9 = `${ddd}${rest.substring(1)}`
      variants.add(without9)
      variants.add(`55${without9}`)
    } else if (phone.length === 12 && rest.length === 8) {
      const with9 = `${ddd}9${rest}`
      variants.add(with9)
      variants.add(`55${with9}`)
    }
  }
  return Array.from(variants)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const webhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET')
    if (!webhookSecret) {
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const receivedSecret = req.headers.get('x-webhook-secret')
    if (receivedSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    console.log('Webhook payload:', payload)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const remoteJid = payload?.data?.key?.remoteJid || payload?.sender || ''
    const rawPhone = remoteJid ? remoteJid.split('@')[0] : ''
    const phone = normalizePhone(rawPhone)

    const text =
      payload?.data?.message?.conversation ||
      payload?.data?.message?.extendedTextMessage?.text ||
      payload?.text ||
      ''

    if (!phone || !text) {
      return new Response(JSON.stringify({ success: true, message: 'No phone or text' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const variants = generatePhoneVariants(phone)

    const { data: candidates, error: candError } = await supabase
      .from('candidatos')
      .select('id, tenant_id, nome, vaga_id, telefone')
      .in('telefone', variants)

    if (candError) {
      console.error('Candidate query error:', candError.message)
    }

    if (!candidates || candidates.length === 0) {
      const { data: waConv } = await supabase
        .from('whatsapp_conversations')
        .select('id, user_id')
        .eq('contact_id', phone)
        .limit(1)
        .maybeSingle()

      if (waConv) {
        await supabase.from('whatsapp_messages').insert({
          conversation_id: waConv.id,
          user_id: waConv.user_id,
          direction: 'in',
          message_text: text,
          raw_payload: payload,
        })
      }
      return new Response(JSON.stringify({ success: true, message: 'No candidate match' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (candidates.length > 1) {
      const nomes = candidates.map((c) => c.nome || 'sem nome').join(', ')
      await supabase.from('acoes_agente').insert({
        tenant_id: candidates[0].tenant_id,
        agent_type: 'assessor',
        tipo_acao: 'notificar_operador',
        agendada_para: new Date().toISOString(),
        status: 'pendente',
        texto_composto: `Número ${phone} casa com múltiplos candidatos: ${nomes}`,
        resultado: text,
      })
      return new Response(
        JSON.stringify({ success: true, message: 'Multiple matches - operator notified' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const candidate = candidates[0]
    const agentType = candidate.vaga_id ? 'assessor' : 'base_ativa'

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { data: existingAction } = await supabase
      .from('acoes_agente')
      .select('id')
      .eq('candidato_id', candidate.id)
      .eq('tipo_acao', 'responder_candidato')
      .in('status', ['pendente', 'executando'])
      .gte('criado_em', twoMinutesAgo)
      .limit(1)
      .maybeSingle()

    if (existingAction) {
      return new Response(
        JSON.stringify({ success: true, message: 'Duplicate action within 2 minutes' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    await supabase.from('acoes_agente').insert({
      tenant_id: candidate.tenant_id,
      agent_type: agentType,
      tipo_acao: 'responder_candidato',
      candidato_id: candidate.id,
      vaga_id: candidate.vaga_id || null,
      agendada_para: new Date().toISOString(),
      status: 'pendente',
      resultado: text,
    })

    let { data: conversa } = await supabase
      .from('conversas')
      .select('id')
      .eq('candidato_id', candidate.id)
      .limit(1)
      .maybeSingle()

    if (!conversa) {
      const { data: newConversa } = await supabase
        .from('conversas')
        .insert({
          tenant_id: candidate.tenant_id,
          candidato_id: candidate.id,
          contexto: 'assessor',
          estado: 'em_conversa',
        })
        .select()
        .single()
      conversa = newConversa
    }

    if (conversa) {
      await supabase.from('mensagens').insert({
        conversa_id: conversa.id,
        direcao: 'entrada',
        conteudo: text,
        status: 'enviada',
      })
    }

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
