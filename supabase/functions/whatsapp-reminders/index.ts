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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const now = new Date()
    const in24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000 + 55 * 60 * 1000)
    const in24hEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 5 * 60 * 1000)

    const { data: agendamentos, error } = await supabase
      .from('agendamentos')
      .select(
        'id, agendada_para, meet_link, candidato_id, candidatos(nome, telefone), vagas(titulo)',
      )
      .eq('status', 'agendada')
      .gte('agendada_para', in24hStart.toISOString())
      .lte('agendada_para', in24hEnd.toISOString())

    if (error) throw error

    let count = 0
    for (const ag of agendamentos || []) {
      if (ag.candidatos && ag.vagas) {
        const candidatonome = ag.candidatos.nome?.split(' ')[0] || 'Candidato'
        const message = `Olá ${candidatonome}! Passando para lembrar da nossa entrevista para a vaga de ${ag.vagas.titulo} amanhã às ${new Date(ag.agendada_para).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. ${ag.meet_link ? 'Link: ' + ag.meet_link : ''}`

        await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            candidateId: ag.candidato_id,
            phone: ag.candidatos.telefone,
            message: message,
            isOutsideHours: false,
          },
        })
        count++
      }
    }

    return new Response(JSON.stringify({ success: true, remindersSent: count }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
