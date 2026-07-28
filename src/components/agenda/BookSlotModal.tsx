import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Search, Check, Loader2 } from 'lucide-react'

interface BookSlotModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slotDate: Date | null
  slotTime: string | null
  jobTitle: string
  jobId: string | null
  duracaoMin: number
  tenantId: string | null
  preselectedCandidateId?: string | null
  onBooked: () => void
}

interface CandidateOption {
  id: string
  nome: string | null
  score: number | null
  status: string
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    novo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    shortlist: 'bg-teal-100 text-teal-700 border-teal-200',
    agendado: 'bg-blue-100 text-blue-700 border-blue-200',
    em_teste: 'bg-violet-100 text-violet-700 border-violet-200',
    entrevistado: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    contratado: 'bg-amber-100 text-amber-700 border-amber-200',
    descartado: 'bg-slate-100 text-slate-700 border-slate-200',
    reprovado: 'bg-red-100 text-red-700 border-red-200',
  }
  return map[status] || 'bg-slate-100 text-slate-700 border-slate-200'
}

export function BookSlotModal({
  open,
  onOpenChange,
  slotDate,
  slotTime,
  jobTitle,
  jobId,
  duracaoMin,
  tenantId,
  preselectedCandidateId,
  onBooked,
}: BookSlotModalProps) {
  const [candidates, setCandidates] = useState<CandidateOption[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState(false)

  useEffect(() => {
    if (!open || !jobId) return
    setLoading(true)
    setSelectedId(null)
    setSearch('')
    supabase
      .from('candidatos')
      .select('id, nome, score, status')
      .eq('vaga_id', jobId)
      .order('score', { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) console.error(error)
        setCandidates(data || [])
        if (preselectedCandidateId && data?.some((c) => c.id === preselectedCandidateId)) {
          setSelectedId(preselectedCandidateId)
        }
        setLoading(false)
      })
  }, [open, jobId, preselectedCandidateId])

  const filtered = candidates.filter((c) => c.nome?.toLowerCase().includes(search.toLowerCase()))
  const endTime = slotDate ? new Date(slotDate.getTime() + duracaoMin * 60000) : null

  const handleBook = async () => {
    if (!selectedId || !jobId || !tenantId || !slotDate) return
    setBooking(true)
    try {
      const agendadaPara = slotDate.toISOString()
      const prevStatus = candidates.find((c) => c.id === selectedId)?.status || 'novo'

      const { data: apt, error: aptErr } = await supabase
        .from('agendamentos')
        .insert({
          candidato_id: selectedId,
          vaga_id: jobId,
          tenant_id: tenantId,
          agendada_para: agendadaPara,
          duracao: duracaoMin,
          status: 'agendada',
          etapa: 1,
        })
        .select('id')
        .single()
      if (aptErr) throw aptErr

      const { error: updErr } = await supabase
        .from('candidatos')
        .update({ status: 'agendado' })
        .eq('id', selectedId)
      if (updErr) throw updErr

      const { error: evtErr } = await supabase.from('candidato_eventos').insert({
        candidato_id: selectedId,
        vaga_id: jobId,
        tenant_id: tenantId,
        tipo: 'mudanca_fase',
        de: prevStatus,
        para: 'agendado',
        agente: 'assessor',
        ator: 'reserva_manual',
        payload: { agendamento_id: apt.id, agendada_para: agendadaPara },
      })
      if (evtErr) throw evtErr

      toast.success('Agendamento criado com sucesso!')
      onBooked()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao agendar entrevista. Tente novamente.')
    } finally {
      setBooking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agendar Entrevista Manualmente</DialogTitle>
          <DialogDescription>Selecione um candidato para preencher este horário.</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium text-slate-400">Vaga</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{jobTitle}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium text-slate-400">Data</p>
              <p className="text-sm font-semibold text-slate-800 capitalize">
                {slotDate && format(slotDate, "d 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium text-slate-400">Horário</p>
              <p className="text-sm font-semibold text-slate-800">
                {slotTime} - {endTime && format(endTime, 'HH:mm')}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium text-slate-400">Duração</p>
              <p className="text-sm font-semibold text-slate-800">{duracaoMin} min</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Candidato</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar candidato..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <ScrollArea className="h-[200px] rounded-md border border-slate-200">
              {loading ? (
                <div className="flex items-center justify-center h-full py-8">
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center h-full py-8">
                  <p className="text-sm text-slate-400">
                    {candidates.length === 0
                      ? 'Nenhum candidato vinculado a esta vaga.'
                      : 'Nenhum resultado.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 transition-colors text-left',
                        selectedId === c.id ? 'bg-blue-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {selectedId === c.id && (
                          <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {c.nome || 'Sem nome'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.score !== null && (
                          <span className="text-xs font-bold text-slate-500">
                            {Math.round(c.score)}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn('text-xs', statusBadgeClass(c.status))}
                        >
                          {c.status}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleBook}
            disabled={booking || !selectedId}
            className="bg-[#457B9D] hover:bg-[#3a6a88]"
          >
            {booking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Agendando...
              </>
            ) : (
              'Agendar Entrevista'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
