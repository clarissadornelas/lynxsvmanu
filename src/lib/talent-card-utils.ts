import { Smile, Meh, AlertTriangle, AlertCircle } from 'lucide-react'

export const SENTIMENT_CONFIG: Record<
  string,
  { label: string; icon: typeof Smile; color: string; textColor: string; bgClass: string }
> = {
  positivo: {
    label: 'Positivo',
    icon: Smile,
    color: 'text-emerald-600',
    textColor: 'text-emerald-700',
    bgClass: 'bg-emerald-50 border-emerald-200',
  },
  neutro: {
    label: 'Neutro',
    icon: Meh,
    color: 'text-slate-500',
    textColor: 'text-slate-600',
    bgClass: 'bg-slate-50 border-slate-200',
  },
  atencao: {
    label: 'Atenção',
    icon: AlertTriangle,
    color: 'text-amber-600',
    textColor: 'text-amber-700',
    bgClass: 'bg-amber-50 border-amber-200',
  },
  risco: {
    label: 'Risco',
    icon: AlertCircle,
    color: 'text-red-600',
    textColor: 'text-red-700',
    bgClass: 'bg-red-50 border-red-200',
  },
}

export function getDaysSince(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  return days === 0 ? 'Hoje' : `Há ${days} dias`
}

export function getDeadlineInfo(contatoAte: string | null): { text: string; isOverdue: boolean } {
  if (!contatoAte) return { text: 'Sem prazo', isOverdue: false }
  const deadline = new Date(contatoAte)
  const now = new Date()
  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0) return { text: `Atrasado ${Math.abs(diffDays)}d`, isOverdue: true }
  if (diffDays === 0) return { text: 'Vence hoje', isOverdue: false }
  return { text: `Faltam ${diffDays}d`, isOverdue: false }
}

export function isCycleExpired(contatoAte: string | null): boolean {
  if (!contatoAte) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadline = new Date(contatoAte)
  deadline.setHours(0, 0, 0, 0)
  return deadline < today
}

export function getCycleStatusLabel(contatoAte: string | null): string {
  if (!contatoAte) return 'Sem limite'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadline = new Date(contatoAte)
  deadline.setHours(0, 0, 0, 0)
  const formatted = deadline.toLocaleDateString('pt-BR')
  if (deadline < today) return `Ciclo encerrado em ${formatted}`
  return `Ciclo: até ${formatted}`
}
