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

    // 1. Legacy Chat Interaction Logic
    if (body.conversa_id && body.message) {
      const { conversa_id, candidato_id, tenant_id, message } = body
      const lowerMsg = message.toLowerCase()

      if (
        lowerMsg.includes('sim') ||
        lowerMsg.includes('agendar') ||
        lowerMsg.includes('pode ser')
      ) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', tenant_id)
          .single()
        const { data: candidato } = await supabase
          .from('candidatos')
          .select('*, vagas(*)')
          .eq('id', candidato_id)
          .single()

        if (tenant && candidato && candidato.vaga_id) {
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          tomorrow.setHours(14, 0, 0, 0)

          await supabase.from('agendamentos').insert({
            tenant_id,
            vaga_id: candidato.vaga_id,
            candidato_id,
            agendada_para: tomorrow.toISOString(),
            calendar_event_id: 'mock_google_event_id_' + Date.now(),
            meet_link: 'https://meet.google.com/mock-link',
            status: 'agendada',
            etapa: 1,
          })

          await supabase.from('candidatos').update({ status: 'agendado' }).eq('id', candidato_id)

          const replyText = `Perfeito! Agendamos sua entrevista para amanhã às 14h. O link da sala é https://meet.google.com/mock-link. Até lá!`

          await supabase.from('mensagens').insert({
            conversa_id,
            direcao: 'saida',
            conteudo: replyText,
            status: 'enviada',
          })

          await supabase.functions.invoke('send-whatsapp-message', {
            body: { candidateId: candidato_id, phone: candidato.telefone, message: replyText },
          })
        }
      }
    }

    // 2. Scheduled CRM Automations (30/60/90 days and periodic pings)
    if (body.task === 'daily_cron') {
      const { data: tenants } = await supabase.from('tenants').select('*').eq('ativo', true)
      for (const tenant of tenants || []) {
        const currentHour = new Date().getUTCHours() - 3
        if (currentHour < tenant.janela_inicio || currentHour >= tenant.janela_fim) continue

        // Onboarding Check-ins
        const { data: hired } = await supabase
          .from('candidatos')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('status', 'contratado')
          .eq('opt_out', false)

        for (const cand of hired || []) {
          if (!cand.contratado_em) continue
          const days = Math.floor((Date.now() - new Date(cand.contratado_em).getTime()) / 86400000)
          if ([30, 60, 90].includes(days) && cand.telefone) {
            const msg = `Oi ${cand.nome}, como está sendo sua experiência na ${tenant.nome}? Gostaríamos de saber como está o onboarding e se há algo que possamos ajudar.`
            await supabase.functions.invoke('send-whatsapp-message', {
              body: { candidateId: cand.id, phone: cand.telefone, message: msg },
            })
          }
        }

        // Periodic Pings for Active Base
        const { data: base } = await supabase
          .from('base_ativa')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('opt_out', false)

        for (const person of base || []) {
          const daysSince = person.ultimo_ping_em
            ? Math.floor((Date.now() - new Date(person.ultimo_ping_em).getTime()) / 86400000)
            : person.cadencia_dias

          if (daysSince >= person.cadencia_dias) {
            const msg = `Oi ${person.nome}, temos uma nova oportunidade que pode ser interessante para você. Gostaria de conversar?`
            await supabase.functions.invoke('send-whatsapp-message', {
              body: { baseId: person.id, phone: person.telefone, message: msg },
            })
            await supabase
              .from('base_ativa')
              .update({ ultimo_ping_em: new Date().toISOString() })
              .eq('id', person.id)
          }
        }
      }
    }

    // 3. Status Changed Webhook (Rejections to Base Ativa)
    if (body.task === 'status_changed') {
      const { candidate_id, tenant_id, new_status } = body
      if (new_status === 'reprovado' || new_status === 'descartado') {
        const { data: cand } = await supabase
          .from('candidatos')
          .select('*, vagas(titulo)')
          .eq('id', candidate_id)
          .single()
        const { data: tenant } = await supabase
          .from('tenants')
          .select('nome')
          .eq('id', tenant_id)
          .single()

        if (cand && tenant && !cand.opt_out && cand.telefone) {
          const msg = `Oi ${cand.nome}, obrigada por participar do processo seletivo para ${cand.vagas?.titulo || 'a vaga'} na ${tenant.nome}. Infelizmente você não passou desta vez, mas adoraríamos manter contato para futuras oportunidades. Você topa ficar na nossa base de talentos?`
          await supabase.functions.invoke('send-whatsapp-message', {
            body: { candidateId: cand.id, phone: cand.telefone, message: msg },
          })

          await supabase.from('base_ativa').upsert(
            {
              tenant_id,
              candidato_id: cand.id,
              nome: cand.nome,
              telefone: cand.telefone,
              origem: 'processo_seletivo',
            },
            { onConflict: 'tenant_id,telefone' },
          )
        }
      }
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
