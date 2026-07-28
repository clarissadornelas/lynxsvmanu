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

export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}
