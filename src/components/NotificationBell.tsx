import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useActiveContext } from '@/stores/useActiveContext'
import { Bell, Clock, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface InterviewAlert {
  id: string
  agendada_para: string
  candidato_nome: string | null
}

async function safeHeadCount(tenantId: string, today: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('base_ativa')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('opt_out', false)
      .or(`adiado_ate.is.null,adiado_ate.lt.${today}`)
      .lt('contato_ate', today)
      .limit(0)

    if (error) {
      console.error('NotificationBell: error fetching overdue count:', error)
      return 0
    }
    return count ?? 0
  } catch (err) {
    console.error('NotificationBell: exception during HEAD count request:', err)
    return 0
  }
}

async function safeFetchInterviews(tenantId: string, today: string): Promise<InterviewAlert[]> {
  try {
    const startOfDay = `${today}T00:00:00.000Z`
    const endOfDay = `${today}T23:59:59.999Z`

    const { data: agendamentos, error } = await supabase
      .from('agendamentos')
      .select('id, agendada_para, candidato_id, candidatos(nome)')
      .eq('tenant_id', tenantId)
      .eq('status', 'agendada')
      .gte('agendada_para', startOfDay)
      .lte('agendada_para', endOfDay)

    if (error) {
      console.error('NotificationBell: error fetching interviews:', error)
      return []
    }

    return (agendamentos || []).map((a: Record<string, unknown>) => ({
      id: a.id as string,
      agendada_para: a.agendada_para as string,
      candidato_nome: (a.candidatos as { nome: string | null } | null)?.nome ?? null,
    }))
  } catch (err) {
    console.error('NotificationBell: exception during interview fetch:', err)
    return []
  }
}

export function NotificationBell() {
  const { tenantId } = useActiveContext()
  const [overdueCount, setOverdueCount] = useState(0)
  const [interviews, setInterviews] = useState<InterviewAlert[]>([])

  const fetchAlerts = useCallback(async () => {
    if (!tenantId) return

    const today = new Date().toISOString().split('T')[0]

    const [count, alerts] = await Promise.all([
      safeHeadCount(tenantId, today),
      safeFetchInterviews(tenantId, today),
    ])

    setOverdueCount(count)
    setInterviews(alerts)
  }, [tenantId])

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 60000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  const total = overdueCount + interviews.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-slate-500">
          <Bell className="w-5 h-5" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold text-slate-900">Notificações</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {total === 0 ? (
          <div className="px-2 py-4 text-center">
            <p className="text-sm text-slate-400">Tudo em dia! Sem notificações.</p>
          </div>
        ) : (
          <>
            {overdueCount > 0 && (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    to="/conversas?ctx=follow_up"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Follow-ups atrasados ({overdueCount})</p>
                      <p className="text-xs text-slate-400">
                        {overdueCount} contato(s) pendente(s)
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {interviews.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs text-slate-400 font-medium">
                  Entrevistas de hoje ({interviews.length})
                </DropdownMenuLabel>
                {interviews.map((iv) => (
                  <DropdownMenuItem key={iv.id} asChild>
                    <Link to="/entrevistas" className="flex items-center gap-2 cursor-pointer">
                      <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{iv.candidato_nome || 'Candidato'}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(iv.agendada_para).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
