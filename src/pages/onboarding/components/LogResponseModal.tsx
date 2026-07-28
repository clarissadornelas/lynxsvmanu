import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'

export function LogResponseModal({ followUp, open, onOpenChange, onSuccess }: any) {
  const [resp, setResp] = useState('')
  const [decisao, setDecisao] = useState('aprovado')
  const [loading, setLoading] = useState(false)

  const is90 = followUp?.dia_follow_up === 90

  const handleSave = async () => {
    setLoading(true)

    const { error: e1 } = await supabase
      .from('follow_ups')
      .update({
        status: 'respondido',
        resposta_candidato: resp,
      })
      .eq('id', followUp.id)

    if (e1) {
      toast.error('Erro: ' + e1.message)
      return setLoading(false)
    }

    if (is90) {
      const { error: e2 } = await supabase
        .from('candidatos')
        .update({
          status: decisao,
        })
        .eq('id', followUp.candidato_id)

      if (e2) toast.error('Erro ao atualizar status final do candidato.')
      else toast.success('Decisão final registrada com sucesso!')
    } else {
      toast.success('Resposta registrada com sucesso.')
    }

    setLoading(false)
    onSuccess()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Resposta - {followUp?.dia_follow_up} Dias</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label>Feedback do Candidato</Label>
            <Textarea
              value={resp}
              onChange={(e) => setResp(e.target.value)}
              rows={4}
              placeholder="Ex: Está tudo ótimo, me adaptei bem à equipe..."
            />
          </div>

          {is90 && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-red-600 font-semibold">
                Decisão Final (Fim do Período de Teste)
              </Label>
              <Select value={decisao} onValueChange={setDecisao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aprovado">Aprovar (Efetivação Permanente)</SelectItem>
                  <SelectItem value="reprovado">Reprovar (Desligamento)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              Salvar Resposta
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
