import { supabase } from '@/lib/supabase/client'
import { getNextContactDate } from '@/lib/cadence-utils'

export interface FollowUpContact {
  id: string
  candidato_id: string | null
  nome: string | null
  foto_url: string | null
  cadencia_dias: number
  contato_ate: string | null
  sentimento: string | null
  ultimo_ping_em: string | null
  lead_quente: boolean
  conversa_id: string | null
  conversa_estado: string | null
  ultima_mensagem: string | null
  delay_days: number
  adiado_ate: string | null
  is_snoozed: boolean
  ultima_mensagem_enviada: string | null
}

export async function fetchFollowUpContacts(tenantId: string): Promise<FollowUpContact[]> {
  const { data, error } = await supabase
    .from('base_ativa')
    .select(
      'id, candidato_id, nome, cadencia_dias, contato_ate, sentimento, ultimo_ping_em, lead_quente, consentimento, opt_out, adiado_ate, candidatos(foto_url)',
    )
    .eq('tenant_id', tenantId)
    .eq('consentimento', true)
    .eq('opt_out', false)

  if (error) throw error
  if (!data) return []

  const today = new Date().toISOString().split('T')[0]
  const filtered = (data as any[]).filter((b) => !b.contato_ate || b.contato_ate >= today)

  const candidatoIds = filtered.filter((b) => b.candidato_id).map((b) => b.candidato_id as string)

  let conversaMap: Record<string, { id: string; estado: string }> = {}
  let lastMsgMap: Record<string, string> = {}
  let followUpMsgMap: Record<string, string> = {}

  if (candidatoIds.length > 0) {
    const [convRes, fuRes] = await Promise.all([
      supabase
        .from('conversas')
        .select('id, estado, candidato_id')
        .in('candidato_id', candidatoIds)
        .eq('tenant_id', tenantId),
      supabase
        .from('follow_ups')
        .select('candidato_id, mensagem_enviada, criado_em')
        .in('candidato_id', candidatoIds)
        .order('criado_em', { ascending: false }),
    ])

    if (convRes.data) {
      for (const c of convRes.data) {
        if (c.candidato_id) {
          conversaMap[c.candidato_id] = { id: c.id, estado: c.estado }
        }
      }
      const convIds = convRes.data.map((c) => c.id)
      if (convIds.length > 0) {
        const { data: msgs } = await supabase
          .from('mensagens')
          .select('conversa_id, conteudo')
          .in('conversa_id', convIds)
          .order('criado_em', { ascending: false })
        if (msgs) {
          for (const m of msgs) {
            if (!lastMsgMap[m.conversa_id]) {
              lastMsgMap[m.conversa_id] = m.conteudo
            }
          }
        }
      }
    }

    if (fuRes.data) {
      for (const f of fuRes.data) {
        if (f.candidato_id && !followUpMsgMap[f.candidato_id] && f.mensagem_enviada) {
          followUpMsgMap[f.candidato_id] = f.mensagem_enviada
        }
      }
    }
  }

  const now = new Date()
  const contacts: FollowUpContact[] = filtered.map((b: any) => {
    const conv = b.candidato_id ? conversaMap[b.candidato_id] : null
    const nextDate = getNextContactDate(b.ultimo_ping_em, b.cadencia_dias)
    const isSnoozed = !!(b.adiado_ate && b.adiado_ate >= today)
    let delayDays = 0
    if (!b.ultimo_ping_em) {
      delayDays = 9999
    } else if (nextDate && nextDate < now) {
      delayDays = Math.floor((now.getTime() - nextDate.getTime()) / 86400000)
    }
    if (isSnoozed) delayDays = 0
    return {
      id: b.id,
      candidato_id: b.candidato_id,
      nome: b.nome,
      foto_url: b.candidatos?.foto_url || null,
      cadencia_dias: b.cadencia_dias,
      contato_ate: b.contato_ate,
      sentimento: b.sentimento,
      ultimo_ping_em: b.ultimo_ping_em,
      lead_quente: b.lead_quente,
      conversa_id: conv?.id || null,
      conversa_estado: conv?.estado || null,
      ultima_mensagem: conv ? lastMsgMap[conv.id] || null : null,
      delay_days: delayDays,
      adiado_ate: b.adiado_ate || null,
      is_snoozed: isSnoozed,
      ultima_mensagem_enviada: b.candidato_id ? followUpMsgMap[b.candidato_id] || null : null,
    }
  })

  contacts.sort((a, b) => {
    if (a.is_snoozed && !b.is_snoozed) return 1
    if (!a.is_snoozed && b.is_snoozed) return -1
    return b.delay_days - a.delay_days
  })
  return contacts
}
