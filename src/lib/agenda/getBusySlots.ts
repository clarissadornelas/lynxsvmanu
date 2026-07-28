import { supabase } from '@/lib/supabase/client'
import { getActiveTenantId } from '@/stores/useActiveContext'

export interface BusySlot {
  inicio: Date
  fim: Date
}

export async function getBusySlots(
  inicio: Date,
  fim: Date,
  agendaId?: string,
): Promise<BusySlot[]> {
  const inicioISO = inicio.toISOString()
  const fimISO = fim.toISOString()

  // Use the centralized active context instead of a non-deterministic
  // .limit(1).maybeSingle() query on the tenants table.
  const tenantId = getActiveTenantId()

  let externoQuery = supabase
    .from('eventos_agenda_externa')
    .select('inicio, fim')
    .gte('inicio', inicioISO)
    .lt('inicio', fimISO)

  if (tenantId) {
    externoQuery = externoQuery.eq('tenant_id', tenantId)
  }

  let bloqueiosQuery = supabase
    .from('bloqueios_agenda')
    .select('inicio, fim')
    .gte('inicio', inicioISO)
    .lt('inicio', fimISO)
    .ilike('agenda_id', agendaId || '%')

  if (tenantId) {
    bloqueiosQuery = bloqueiosQuery.eq('tenant_id', tenantId)
  }

  let agendamentosQuery = supabase
    .from('agendamentos')
    .select('agendada_para, duracao')
    .in('status', ['agendada', 'confirmada'])
    .gte('agendada_para', inicioISO)
    .lt('agendada_para', fimISO)

  if (tenantId) {
    agendamentosQuery = agendamentosQuery.eq('tenant_id', tenantId)
  }

  const [blocksRes, agendamentosRes, externosRes] = await Promise.all([
    bloqueiosQuery,
    agendamentosQuery,
    externoQuery,
  ])

  const blockSlots: BusySlot[] = (blocksRes.data || []).map((b) => ({
    inicio: new Date(b.inicio),
    fim: new Date(b.fim),
  }))

  const agendamentoSlots: BusySlot[] = (agendamentosRes.data || []).map((a) => {
    const start = new Date(a.agendada_para)
    const durationMinutes = a.duracao ?? 30
    const end = new Date(start.getTime() + durationMinutes * 60000)
    return { inicio: start, fim: end }
  })

  const externoSlots: BusySlot[] = (externosRes.data || []).map((e) => ({
    inicio: new Date(e.inicio),
    fim: new Date(e.fim),
  }))

  return [...blockSlots, ...agendamentoSlots, ...externoSlots]
}
