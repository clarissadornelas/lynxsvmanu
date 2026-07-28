import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertTriangle,
  Users,
  CheckCircle2,
  CalendarClock,
  Flame,
  Ban,
  AlertCircle,
} from 'lucide-react'
import { getNextContactDate } from '@/lib/cadence-utils'
import { isCycleExpired } from '@/lib/talent-card-utils'
import { StatCard } from '@/components/StatCard'

export function BaseAtivaSummary({ baseAtiva }: { baseAtiva: any[] }) {
  const stats = useMemo(() => {
    const now = new Date()
    const in7Days = new Date()
    in7Days.setDate(in7Days.getDate() + 7)

    let delayed = 0,
      neverContacted = 0,
      emDia = 0,
      proximos7 = 0,
      leadsQuentes = 0,
      optOut = 0,
      naBase = 0,
      ciclosEncerrados = 0,
      emRisco = 0,
      emAtencao = 0

    for (const b of baseAtiva) {
      if (b.opt_out) {
        optOut++
        if (b.lead_quente) leadsQuentes++
        continue
      }
      naBase++

      const todayStr = new Date().toISOString().split('T')[0]
      const isSnoozed = !!(b.adiado_ate && b.adiado_ate >= todayStr)

      if (b.sentimento === 'risco') emRisco++
      if (b.sentimento === 'atencao') emAtencao++

      if (isCycleExpired(b.contato_ate)) {
        ciclosEncerrados++
        continue
      }

      if (b.lead_quente) leadsQuentes++

      if (!b.ultimo_ping_em) {
        if (b.consentimento && !isSnoozed) {
          delayed++
          neverContacted++
        }
        continue
      }

      const next = getNextContactDate(b.ultimo_ping_em, b.cadencia_dias)
      if (!next) continue

      if (next < now && !isSnoozed) delayed++
      else if (next <= in7Days) proximos7++
      else emDia++
    }

    return {
      delayed,
      neverContacted,
      emDia,
      proximos7,
      leadsQuentes,
      optOut,
      naBase,
      ciclosEncerrados,
      emRisco,
      emAtencao,
    }
  }, [baseAtiva])

  const isEmpty = baseAtiva.length === 0

  const smallCards = [
    {
      label: 'Na base',
      value: stats.naBase,
      icon: Users,
      color: 'text-slate-600',
      tooltip: 'Total de talentos ativos (opt_out = false)',
    },
    {
      label: 'Em dia',
      value: stats.emDia,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      tooltip: 'Próximo contato agendado para depois de hoje',
    },
    {
      label: 'Próximos 7 dias',
      value: stats.proximos7,
      icon: CalendarClock,
      color: 'text-blue-600',
      tooltip: 'Próximo contato dentro dos próximos 7 dias',
    },
    {
      label: 'Leads quentes',
      value: stats.leadsQuentes,
      icon: Flame,
      color: 'text-orange-600',
      tooltip: 'Talentos marcados como lead_quente = true',
    },
    {
      label: 'Ciclos encerrados',
      value: stats.ciclosEncerrados,
      icon: CalendarClock,
      color: 'text-slate-400',
      tooltip: 'Talentos com contato_ate no passado (ciclo encerrado)',
    },
    {
      label: 'Opt-out',
      value: stats.optOut,
      icon: Ban,
      color: 'text-slate-400',
      tooltip: 'Talentos que optaram por não receber contato',
    },
  ]

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-amber-300 bg-amber-50 cursor-help">
                <CardContent className="p-4 flex items-center gap-4">
                  <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-amber-900">
                      Follow-ups atrasados
                    </span>
                    <p className="text-3xl font-bold text-amber-700">{stats.delayed}</p>
                  </div>
                  <p className="text-xs text-amber-700/70 text-right">
                    {stats.delayed - stats.neverContacted} atrasados
                    <br />· {stats.neverContacted} nunca contatados
                  </p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Talentos onde opt_out=false e (último ping + cadência &lt; hoje OU nunca contatados
                com consentimento=true). Ciclos encerrados são excluídos.
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="border-red-300 bg-red-50 cursor-help">
                <CardContent className="p-4 flex items-center gap-4">
                  <AlertCircle className="w-8 h-8 text-red-600 shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-red-900">Em risco</span>
                    <p className="text-3xl font-bold text-red-700">{stats.emRisco}</p>
                  </div>
                  <p className="text-xs text-red-700/70 text-right">
                    {stats.emAtencao > 0 ? `· ${stats.emAtencao} em atenção` : 'Avaliação manual'}
                  </p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Talentos com sentimento = 'risco'. Indica que o engajamento pode estar perdido e o
                talento pode sair da base.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {smallCards.map((card) => (
            <Tooltip key={card.label}>
              <TooltipTrigger asChild>
                <StatCard
                  icon={card.icon}
                  label={card.label}
                  value={card.value}
                  color={card.color}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{card.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {isEmpty && (
          <p className="text-center text-sm text-slate-400 py-2">Nenhum talento na base ainda</p>
        )}
      </div>
    </TooltipProvider>
  )
}
