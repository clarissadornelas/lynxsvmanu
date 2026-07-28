import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, MessageCircle } from 'lucide-react'
import type { BaseAtivaWithRelations } from '@/types/recruitment'

interface RegisterContactDialogProps {
  talent: BaseAtivaWithRelations
  open: boolean
  onOpenChange: (v: boolean) => void
  onRefresh?: () => void
}

export function RegisterContactDialog({
  talent,
  open,
  onOpenChange,
  onRefresh,
}: RegisterContactDialogProps) {
  const [notes, setNotes] = useState('')
  const [registering, setRegistering] = useState(false)

  const handleRegister = async () => {
    if (!talent.candidato_id) {
      toast.error('Este talento não tem candidato vinculado. Não é possível registrar contato.')
      return
    }
    setRegistering(true)

    const now = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('base_ativa')
      .update({
        ultimo_ping_em: now,
        pings_enviados: (talent.pings_enviados || 0) + 1,
      })
      .eq('id', talent.id)

    if (updateError) {
      toast.error('Erro ao registrar contato: ' + updateError.message)
      setRegistering(false)
      return
    }

    const { error: followUpError } = await supabase.from('follow_ups').insert({
      candidato_id: talent.candidato_id,
      tenant_id: talent.tenant_id,
      data_agendada: now.split('T')[0],
      data_enviado: now,
      dia_follow_up: (talent.pings_enviados || 0) + 1,
      status: 'enviado',
      mensagem_enviada: notes || null,
    })

    if (followUpError) {
      toast.error('Erro ao registrar follow-up: ' + followUpError.message)
      setRegistering(false)
      return
    }

    toast.success('Contato registrado com sucesso!')
    setRegistering(false)
    setNotes('')
    onOpenChange(false)
    onRefresh?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Registrar contato
          </DialogTitle>
          <DialogDescription>
            Confirme o contato com{' '}
            <span className="font-semibold text-slate-700">{talent.nome}</span>. Isso atualizará a
            data do último contato e incrementará o contador de pings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label className="text-xs">Notas (opcional)</Label>
          <Textarea
            placeholder="Anotações sobre o contato realizado..."
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={registering}>
            Cancelar
          </Button>
          <Button onClick={handleRegister} disabled={registering}>
            {registering ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
