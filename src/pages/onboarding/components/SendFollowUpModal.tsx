import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export function SendFollowUpModal({ followUp, open, onOpenChange, onSuccess }: any) {
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!followUp) return
    const nome = followUp.candidatos?.nome?.split(' ')[0] || 'Candidato'
    const emp = followUp.candidatos?.empresa || followUp.candidatos?.vagas?.empresa || 'sua empresa'

    if (followUp.dia_follow_up === 30) {
      setMsg(
        `Olá ${nome}, tudo bem? Gostaria de saber como está indo seu processo de integração na ${emp}. Qualquer dúvida, estou à disposição!`,
      )
    } else if (followUp.dia_follow_up === 60) {
      setMsg(
        `Oi ${nome}, fazendo um acompanhamento do seu andamento. Como está a experiência até agora? Precisa de algo?`,
      )
    } else {
      setMsg(
        `Olá ${nome}, chegamos ao final do período de teste. Gostaria de validar se tudo está certo e se você está satisfeito com a posição. Podemos conversar?`,
      )
    }
  }, [followUp])

  const handleSend = async () => {
    setLoading(true)
    const { error } = await supabase
      .from('follow_ups')
      .update({
        status: 'enviado',
        mensagem_enviada: msg,
        data_enviado: new Date().toISOString(),
      })
      .eq('id', followUp.id)

    setLoading(false)
    if (error) toast.error('Erro: ' + error.message)
    else {
      toast.success('Follow-up marcado como enviado.')
      onSuccess()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Envio - {followUp?.dia_follow_up} Dias</DialogTitle>
          <DialogDescription>
            Copie a mensagem abaixo para enviar ao candidato via WhatsApp/Email e confirme o envio
            para atualizar o status.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={loading}>
              Marcar como Enviado
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
