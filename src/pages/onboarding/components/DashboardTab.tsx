import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Users, AlertCircle, CalendarClock } from 'lucide-react'
import { startOfWeek, endOfWeek, format } from 'date-fns'
import { MetricCard } from '@/components/MetricCard'

export function DashboardTab() {
  const [stats, setStats] = useState({ emTeste: 0, naSemana: 0, atrasados: 0 })

  useEffect(() => {
    async function loadStats() {
      const { count: emTeste } = await supabase
        .from('candidatos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'em_teste')

      const today = new Date()
      const sOfWeek = format(startOfWeek(today), 'yyyy-MM-dd')
      const eOfWeek = format(endOfWeek(today), 'yyyy-MM-dd')
      const todayStr = format(today, 'yyyy-MM-dd')

      const { count: naSemana } = await supabase
        .from('follow_ups')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente')
        .gte('data_agendada', sOfWeek)
        .lte('data_agendada', eOfWeek)

      const { count: atrasados } = await supabase
        .from('follow_ups')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente')
        .lt('data_agendada', todayStr)

      setStats({
        emTeste: emTeste || 0,
        naSemana: naSemana || 0,
        atrasados: atrasados || 0,
      })
    }
    loadStats()
  }, [])

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard
        title="Em Período de Teste"
        value={stats.emTeste}
        icon={Users}
        tooltip="Candidatos que estão atualmente em período de teste"
        iconClassName="text-muted-foreground"
      />
      <MetricCard
        title="Follow-ups na Semana"
        value={stats.naSemana}
        icon={CalendarClock}
        tooltip="Follow-ups agendados para esta semana"
        iconClassName="text-muted-foreground"
      />
      <MetricCard
        title="Follow-ups Atrasados"
        value={stats.atrasados}
        icon={AlertCircle}
        tooltip="Follow-ups pendentes que já passaram da data agendada"
        iconClassName="text-red-500"
        valueClassName="text-red-600"
      />
    </div>
  )
}
