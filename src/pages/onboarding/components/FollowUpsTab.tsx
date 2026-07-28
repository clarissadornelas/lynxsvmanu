import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format, isBefore, startOfDay } from 'date-fns'
import { SendFollowUpModal } from './SendFollowUpModal'
import { LogResponseModal } from './LogResponseModal'

export function FollowUpsTab() {
  const [followUps, setFollowUps] = useState<any[]>([])
  const [selectedForSend, setSelectedForSend] = useState<any>(null)
  const [selectedForLog, setSelectedForLog] = useState<any>(null)

  const loadData = async () => {
    const { data } = await supabase
      .from('follow_ups')
      .select('*, candidatos(nome, empresa, vagas(empresa))')
      .in('status', ['pendente', 'enviado'])
      .order('data_agendada', { ascending: true })
    if (data) setFollowUps(data)
  }

  useEffect(() => {
    loadData()
  }, [])

  const today = startOfDay(new Date())

  return (
    <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200">
      <h3 className="text-lg font-semibold">Próximos Follow-ups</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data Agendada</TableHead>
            <TableHead>Candidato</TableHead>
            <TableHead>Marco</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {followUps.map((f) => {
            const date = new Date(f.data_agendada)
            // Need to append time to date string to avoid timezone shifts when parsing from string
            const fixDate = new Date(f.data_agendada + 'T00:00:00')
            const isLate = f.status === 'pendente' && isBefore(fixDate, today)

            return (
              <TableRow key={f.id}>
                <TableCell className={isLate ? 'text-red-600 font-medium' : ''}>
                  {format(fixDate, 'dd/MM/yyyy')} {isLate && ' (Atrasado)'}
                </TableCell>
                <TableCell>{f.candidatos?.nome}</TableCell>
                <TableCell>{f.dia_follow_up} Dias</TableCell>
                <TableCell>
                  <Badge variant={f.status === 'pendente' ? 'secondary' : 'default'}>
                    {f.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {f.status === 'pendente' ? (
                    <Button size="sm" variant="outline" onClick={() => setSelectedForSend(f)}>
                      Marcar Enviado
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setSelectedForLog(f)}>
                      Registrar Resposta
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
          {followUps.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-6 text-slate-500">
                Nenhum follow-up pendente ou aguardando resposta.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {selectedForSend && (
        <SendFollowUpModal
          followUp={selectedForSend}
          open={!!selectedForSend}
          onOpenChange={(v: boolean) => !v && setSelectedForSend(null)}
          onSuccess={loadData}
        />
      )}

      {selectedForLog && (
        <LogResponseModal
          followUp={selectedForLog}
          open={!!selectedForLog}
          onOpenChange={(v: boolean) => !v && setSelectedForLog(null)}
          onSuccess={loadData}
        />
      )}
    </div>
  )
}
