import { supabase } from '@/lib/supabase/client'

export interface AgendaExterna {
  id: string
  tenant_id: string
  rotulo: string | null
  ical_url: string | null
  ultima_sincronizacao: string | null
  ativa: boolean
  criado_em: string
}

export async function fetchAgendasExternas(tenantId: string) {
  const { data, error } = await supabase
    .from('agendas_externas')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('criado_em', { ascending: false })
  return { data: (data as AgendaExterna[]) ?? [], error }
}

export async function createAgendaExterna(tenantId: string, rotulo: string, icalUrl: string) {
  const { data, error } = await supabase
    .from('agendas_externas')
    .insert({ tenant_id: tenantId, rotulo: rotulo || null, ical_url: icalUrl })
    .select()
    .single()
  return { data: data as AgendaExterna | null, error }
}

export async function deleteAgendaExterna(id: string) {
  const { error } = await supabase.from('agendas_externas').delete().eq('id', id)
  return { error }
}

export async function toggleAgendaExterna(id: string, ativa: boolean) {
  const { error } = await supabase.from('agendas_externas').update({ ativa }).eq('id', id)
  return { error }
}

export async function syncAgendaIcal(agendaExternaId: string) {
  const { data, error } = await supabase.functions.invoke('sync-agenda-ical', {
    body: { agenda_externa_id: agendaExternaId },
  })
  return { data, error }
}

export async function countEventosAgendaExterna(agendaExternaId: string) {
  const { count, error } = await supabase
    .from('eventos_agenda_externa')
    .select('*', { count: 'exact', head: true })
    .eq('agenda_externa_id', agendaExternaId)
  return { count: count ?? 0, error }
}

export interface EventoAgendaExterna {
  id: string
  inicio: string
  fim: string
  titulo: string | null
  agenda_externa_id: string
}

export async function fetchEventosAgendaExternaSemana(startDateISO: string, endDateISO: string) {
  const { data, error } = await supabase
    .from('eventos_agenda_externa')
    .select('id, inicio, fim, titulo, agenda_externa_id')
    .gte('inicio', startDateISO)
    .lt('inicio', endDateISO)
    .order('inicio', { ascending: true })
  return { data: (data as EventoAgendaExterna[]) ?? [], error }
}
