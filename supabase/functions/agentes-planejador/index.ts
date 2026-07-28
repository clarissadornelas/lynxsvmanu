import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

function getAgendadaPara(janelaInicio: number, janelaFim: number): string {
  const now = new Date()
  const brHour = (now.getUTCHours() - 3 + 24) % 24
  if (brHour >= janelaInicio && brHour < janelaFim) return now.toISOString()
  const d = new Date(now)
  if (brHour < janelaInicio) {
    d.setUTCHours(janelaInicio + 3, 0, 0, 0)
  } else {
    d.setUTCDate(d.getUTCDate() + 1)
    d.setUTCHours(janelaInicio + 3, 0, 0, 0)
  }
  return d.toISOString()
}

async function isActionUnique(
  tenantId: string,
  candidatoId: string,
  tipoAcao: string,
  statuses: string[],
): Promise<boolean> {
  const { data, error } = await supabase
    .from('acoes_agente')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('candidato_id', candidatoId)
    .eq('tipo_acao', tipoAcao)
    .in('status', statuses)
    .limit(1)
  if (error) {
    console.error('Idempotency check error:', error.message)
    return false
  }
  return !data || data.length === 0
}

async function insertAcao(payload: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from('acoes_agente').insert(payload)
  if (error) {
    console.error('Insert acao error:', error.message)
    return false
  }
  return true
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86400000)
}

function formatDatePtBR(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

function formatDateTimePtBR(date: Date): string {
  return date.toLocaleString('pt-BR')
}

async function ultimaAcaoConcluida(
  tenantId: string,
  candidatoId: string,
  tipoAcao: string,
): Promise<Date | null> {
  const { data, error } = await supabase
    .from('acoes_agente')
    .select('executada_em, criado_em')
    .eq('tenant_id', tenantId)
    .eq('candidato_id', candidatoId)
    .eq('tipo_acao', tipoAcao)
    .in('status', ['concluida', 'simulada'])
    .order('executada_em', { ascending: false, nullsFirst: false })
    .limit(1)
  if (error) {
    console.error('ultimaAcaoConcluida error:', error.message)
    return null
  }
  if (!data || data.length === 0) return null
  const row = data[0]
  if (row.executada_em) return new Date(row.executada_em)
  if (row.criado_em) return new Date(row.criado_em)
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const summary = {
    tenants_processados: 0,
    acoes_criadas: 0,
    detalhamento: { follow_up_base: 0, cobranca_sem_resposta: 0, lembrete_roteiro: 0 },
  }

  try {
    const { data: tenants, error: tErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('ativo', true)
    if (tErr) {
      console.error('Error fetching tenants:', tErr.message)
      throw tErr
    }

    for (const tenant of tenants ?? []) {
      summary.tenants_processados++
      const { data: configs, error: cfgErr } = await supabase
        .from('configuracoes_agente')
        .select('*')
        .eq('tenant_id', tenant.id)
      if (cfgErr) {
        console.error(`Config error for tenant ${tenant.id}:`, cfgErr.message)
        continue
      }

      const cfgMap: Record<string, any> = {}
      for (const c of configs ?? []) {
        if (c.agent_type) cfgMap[c.agent_type] = c
      }
      const isActive = (t: string) => !cfgMap[t] || cfgMap[t].ativo !== false
      const diasSemResposta = cfgMap['assessor']?.dias_sem_resposta || 5
      const tenantCadencia = cfgMap['base_ativa']?.cadencia_follow_up_dias || 7
      const winPara = () => getAgendadaPara(tenant.janela_inicio, tenant.janela_fim)

      if (isActive('base_ativa')) {
        const { data: base, error: bErr } = await supabase
          .from('base_ativa')
          .select('candidato_id, nome, criado_em, ultimo_ping_em, cadencia_dias')
          .eq('tenant_id', tenant.id)
          .eq('opt_out', false)
          .not('candidato_id', 'is', null)
        if (bErr) {
          console.error('base_ativa fetch error:', bErr.message)
        }
        for (const p of base ?? []) {
          if (
            !(await isActionUnique(tenant.id, p.candidato_id, 'follow_up_base', [
              'pendente',
              'executando',
              'aguardando_humano',
            ]))
          )
            continue

          const cadenciaEfetiva = p.cadencia_dias || tenantCadencia

          const { data: fu, error: fuErr } = await supabase
            .from('follow_ups')
            .select('data_agendada, data_enviado')
            .eq('candidato_id', p.candidato_id)
            .order('data_agendada', { ascending: false })
            .limit(1)
          if (fuErr) console.error('follow_ups fetch error:', fuErr.message)

          let last = new Date(p.criado_em)
          if (p.ultimo_ping_em && new Date(p.ultimo_ping_em) > last)
            last = new Date(p.ultimo_ping_em)
          if (fu?.[0]) {
            const fd = fu[0].data_enviado
              ? new Date(fu[0].data_enviado)
              : new Date(fu[0].data_agendada)
            if (fd > last) last = fd
          }

          const lastActionDate = await ultimaAcaoConcluida(
            tenant.id,
            p.candidato_id,
            'follow_up_base',
          )
          if (lastActionDate && lastActionDate > last) last = lastActionDate

          const elapsedDays = daysSince(last)
          if (elapsedDays >= cadenciaEfetiva) {
            const motivo = `Sem contato desde ${formatDatePtBR(last)} (${elapsedDays} dias), cadência ${cadenciaEfetiva} dias`
            if (
              await insertAcao({
                tenant_id: tenant.id,
                agent_type: 'base_ativa',
                tipo_acao: 'follow_up_base',
                candidato_id: p.candidato_id,
                agendada_para: winPara(),
                status: 'pendente',
                texto_composto: `Follow-up - ${p.nome || 'contato'}`,
                motivo,
              })
            ) {
              summary.acoes_criadas++
              summary.detalhamento.follow_up_base++
            }
          }
        }
      }

      if (isActive('assessor')) {
        const { data: cands, error: cErr } = await supabase
          .from('candidatos')
          .select('id, nome, vaga_id, criado_em')
          .eq('tenant_id', tenant.id)
          .eq('status', 'contatado')
          .eq('opt_out', false)
        if (cErr) {
          console.error('candidatos fetch error:', cErr.message)
        }
        for (const c of cands ?? []) {
          if (
            !(await isActionUnique(tenant.id, c.id, 'cobranca_sem_resposta', [
              'pendente',
              'executando',
              'aguardando_humano',
            ]))
          )
            continue
          const { data: evts, error: evErr } = await supabase
            .from('candidato_eventos')
            .select('criado_em')
            .eq('candidato_id', c.id)
            .order('criado_em', { ascending: false })
            .limit(1)
          if (evErr) console.error('candidato_eventos fetch error:', evErr.message)

          let last = evts?.[0] ? new Date(evts[0].criado_em) : new Date(c.criado_em)

          const lastActionDate = await ultimaAcaoConcluida(tenant.id, c.id, 'cobranca_sem_resposta')
          if (lastActionDate && lastActionDate > last) last = lastActionDate

          const elapsedDays = daysSince(last)
          if (elapsedDays >= diasSemResposta) {
            const motivo = `Sem resposta desde ${formatDatePtBR(last)} (${elapsedDays} dias), paciência ${diasSemResposta} dias`
            if (
              await insertAcao({
                tenant_id: tenant.id,
                agent_type: 'assessor',
                tipo_acao: 'cobranca_sem_resposta',
                candidato_id: c.id,
                vaga_id: c.vaga_id,
                agendada_para: winPara(),
                status: 'pendente',
                texto_composto: `Cobranca - ${c.nome || 'candidato'}`,
                motivo,
              })
            ) {
              summary.acoes_criadas++
              summary.detalhamento.cobranca_sem_resposta++
            }
          }
        }
      }

      if (isActive('copiloto')) {
        const now = new Date()
        const { data: ags, error: aErr } = await supabase
          .from('agendamentos')
          .select('id, candidato_id, vaga_id, agendada_para')
          .eq('tenant_id', tenant.id)
          .in('status', ['agendada', 'confirmada'])
          .gte('agendada_para', now.toISOString())
          .lte('agendada_para', new Date(now.getTime() + 86400000).toISOString())
        if (aErr) {
          console.error('agendamentos fetch error:', aErr.message)
        }
        for (const ag of ags ?? []) {
          if (!(await isActionUnique(tenant.id, ag.candidato_id, 'lembrete_roteiro', ['pendente'])))
            continue
          const { data: ent, error: entErr } = await supabase
            .from('entrevistas')
            .select('id, roteiro')
            .eq('agendamento_id', ag.id)
            .limit(1)
          if (entErr) {
            console.error('entrevistas fetch error:', entErr.message)
            continue
          }
          if (!ent?.[0] || !ent[0].roteiro) {
            const agDate = new Date(ag.agendada_para)
            const motivo = `Entrevista em ${formatDateTimePtBR(agDate)} sem roteiro pronto`
            if (
              await insertAcao({
                tenant_id: tenant.id,
                agent_type: 'copiloto',
                tipo_acao: 'lembrete_roteiro',
                candidato_id: ag.candidato_id,
                vaga_id: ag.vaga_id,
                agendada_para: now.toISOString(),
                status: 'pendente',
                texto_composto: `Lembrete roteiro - ${agDate.toLocaleString('pt-BR')}`,
                motivo,
              })
            ) {
              summary.acoes_criadas++
              summary.detalhamento.lembrete_roteiro++
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, ...summary }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
