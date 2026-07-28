export const AGENT_LABELS: Record<string, string> = {
  assessor: 'Meu Assessor',
  copiloto: 'Copiloto',
  base_ativa: 'Base Ativa',
}

export const ACTION_LABELS: Record<string, string> = {
  follow_up_base: 'Follow-up Base',
  cobranca_sem_resposta: 'Cobrança sem resposta',
  lembrete_roteiro: 'Lembrete de roteiro',
  notificar_operador: 'Notificar operador',
  responder_candidato: 'Responder candidato',
}

export function formatRelativeTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const dateDay = date.toDateString()
  const todayDay = now.toDateString()

  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (dateDay === todayDay) return `hoje ${time}`

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dateDay === tomorrow.toDateString()) return `amanhã ${time}`

  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > 0 && diffDays < 7) {
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' })
    return `${weekday} ${time}`
  }

  const shortDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${shortDate} ${time}`
}

export function getTodayRange(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}
