import type { Candidate } from '@/stores/useRecruitmentStore'
import { cn } from '@/lib/utils'

const FUNNEL_STATUSES = [
  { key: 'novo', label: 'Novo', className: 'bg-[#C4E2D7] text-emerald-900' },
  { key: 'shortlist', label: 'Shortlist', className: 'bg-[#5DCAA5] text-white' },
  { key: 'agendado', label: 'Agendado', className: 'bg-[#0F6E56] text-white' },
  { key: 'em_teste', label: 'Em teste', className: 'bg-[#B6B0EE] text-indigo-900' },
  { key: 'entrevistado', label: 'Entrevistado', className: 'bg-[#534AB7] text-white' },
  { key: 'contratado', label: 'Contratado', className: 'bg-[#BA7517] text-white' },
  { key: 'descartado', label: 'Descartado', className: 'bg-[#8A8980] text-white' },
  { key: 'reprovado', label: 'Reprovado', className: 'bg-[#A32D2D] text-white' },
] as const

export function JobFunnelSummary({ candidates }: { candidates: Candidate[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {FUNNEL_STATUSES.map((s) => {
        const count = candidates.filter((c) => c.status === s.key).length
        return (
          <div key={s.key} className={cn('rounded-lg p-2 text-center', s.className)}>
            <p className="text-lg font-bold">{count}</p>
            <p className="text-xs">{s.label}</p>
          </div>
        )
      })}
    </div>
  )
}
