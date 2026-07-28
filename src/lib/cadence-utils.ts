export function getNextContactDate(
  ultimoPingEm: string | null,
  cadenciaDias: number | null,
): Date | null {
  if (!ultimoPingEm) return null
  const next = new Date(ultimoPingEm)
  next.setDate(next.getDate() + (cadenciaDias || 30))
  return next
}

export function getStatusInfo(talent: {
  ultimo_ping_em: string | null
  cadencia_dias: number | null
  adiado_ate?: string | null
}) {
  if (talent.adiado_ate) {
    const todayStr = new Date().toISOString().split('T')[0]
    if (talent.adiado_ate >= todayStr) {
      return { color: 'bg-slate-400', label: 'Adiado', textColor: 'text-slate-500' }
    }
  }
  if (!talent.ultimo_ping_em) {
    return { color: 'bg-slate-300', label: 'A iniciar', textColor: 'text-slate-500' }
  }
  const next = getNextContactDate(talent.ultimo_ping_em, talent.cadencia_dias)
  const now = new Date()
  if (next && next < now) {
    const daysLate = Math.floor((now.getTime() - next.getTime()) / 86400000)
    return { color: 'bg-amber-400', label: `Atrasado ${daysLate}d`, textColor: 'text-amber-600' }
  }
  return { color: 'bg-emerald-400', label: 'Em dia', textColor: 'text-emerald-600' }
}

export function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return 'nunca'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}
