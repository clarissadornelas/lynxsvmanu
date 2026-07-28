import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useRecruitment, Candidate, CandidateStatus } from '@/stores/use-recruitment'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { MessageCircle, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const COLUMNS: { id: CandidateStatus; label: string; color: string }[] = [
  { id: 'analise', label: 'Análise', color: 'bg-slate-200' },
  { id: 'aprovado', label: 'Aprovado', color: 'bg-amber-200' },
  { id: 'abordagem', label: 'Abordagem (WhatsApp)', color: 'bg-blue-200' },
  { id: 'agendado', label: 'Agendado', color: 'bg-emerald-200' },
]

export default function JobKanban() {
  const { jobId } = useParams()
  const { jobs, candidates, updateCandidateStatus, addInteraction } = useRecruitment()
  const { toast } = useToast()
  const job = jobs.find((j) => j.id === jobId) || jobs[0]

  const [activeCand, setActiveCand] = useState<Candidate | null>(null)
  const [showWhatsappModal, setShowWhatsappModal] = useState(false)
  const currentHour = new Date().getHours()
  const isBusinessHours = currentHour >= 8 && currentHour < 18

  const jobCandidates = candidates.filter((c) => c.jobId === job?.id)

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('candId', id)
    if (e.currentTarget instanceof HTMLElement)
      e.currentTarget.classList.add('kanban-card-dragging')
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement)
      e.currentTarget.classList.remove('kanban-card-dragging')
  }

  const handleDrop = (e: React.DragEvent, status: CandidateStatus) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('candId')
    if (!id) return

    const cand = candidates.find((c) => c.id === id)
    if (!cand || cand.status === status) return

    updateCandidateStatus(id, status)

    if (status === 'aprovado') {
      setActiveCand(cand)
      setShowWhatsappModal(true)
    }
  }

  const confirmWhatsApp = async () => {
    if (activeCand) {
      const message = `Oi ${activeCand.name.split(' ')[0]}, tudo bem? Vimos seu perfil e achamos um ótimo fit para a vaga de ${job.title}...`

      addInteraction({
        id: `int-${Date.now()}`,
        candidateId: activeCand.id,
        type: 'whatsapp',
        message,
        date: new Date().toISOString(),
      })

      toast({
        title: isBusinessHours ? 'Mensagem Enviada!' : 'Mensagem Enfileirada',
        description: isBusinessHours
          ? 'A abordagem foi iniciada no WhatsApp.'
          : 'Fora do horário comercial. Será enviada amanhã às 08h.',
      })
      updateCandidateStatus(activeCand.id, 'abordagem')

      await supabase.functions.invoke('send-whatsapp-message', {
        body: {
          candidateId: activeCand.id,
          phone: activeCand.phone,
          message,
          isOutsideHours: !isBusinessHours,
        },
      })
    }
    setShowWhatsappModal(false)
  }

  return (
    <div className="h-full flex flex-col space-y-4 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Kanban de Recrutamento</h2>
        <p className="text-muted-foreground">
          {job?.title} - {job?.company}
        </p>
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className="flex-shrink-0 w-80 bg-slate-100 rounded-xl p-4 flex flex-col max-h-full"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{col.label}</h3>
              <Badge variant="secondary">
                {jobCandidates.filter((c) => c.status === col.id).length}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {jobCandidates
                .filter((c) => c.status === col.id)
                .map((cand) => (
                  <Card
                    key={cand.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, cand.id)}
                    onDragEnd={handleDragEnd}
                    className="cursor-grab hover:border-primary/50"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={cand.avatarUrl || undefined} />
                            <AvatarFallback>{cand.name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold">{cand.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Score: {cand.matchScore}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showWhatsappModal} onOpenChange={setShowWhatsappModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Abordagem via WhatsApp</DialogTitle>
            <DialogDescription>
              Uma mensagem automatizada será enviada para {activeCand?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-4 rounded-md text-sm my-4 font-mono">
            "Oi {activeCand?.name.split(' ')[0]}, tudo bem? Vimos seu perfil e achamos que você é um
            ótimo fit para a vaga de {job?.title} na {job?.company}. Tem interesse em bater um
            papo?"
          </div>
          {!isBusinessHours && (
            <div className="flex items-center text-amber-600 text-sm gap-2">
              <Clock className="h-4 w-4" /> Fora do horário. Envio programado para o próximo dia
              útil às 08:00.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWhatsappModal(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmWhatsApp} className="bg-green-600 hover:bg-green-700">
              <MessageCircle className="mr-2 h-4 w-4" />{' '}
              {isBusinessHours ? 'Enviar Agora' : 'Enfileirar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
