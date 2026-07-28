import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface DangerZoneProps {
  tipo: 'candidato' | 'vaga'
  recordId: string
  recordName: string
  redirectPath: string
  onClose?: () => void
}

const TABLE_LABELS: Record<string, string> = {
  messages: 'mensagens',
  conversations: 'conversas',
  follow_ups: 'follow-ups',
  interviews: 'entrevistas',
  appointments: 'agendamentos',
  candidate_events: 'eventos',
  processos: 'processos',
  base_ativa: 'registros da base ativa',
}

export function DangerZone({ tipo, recordId, recordName, redirectPath, onClose }: DangerZoneProps) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const isMatch = recordName.length > 0 && confirmText.trim() === recordName

  const handleDelete = async () => {
    if (!isMatch || loading) return
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('delete-record', {
        body: { tipo, id: recordId, confirmacao: confirmText.trim() },
      })
      if (error) throw error
      if (data?.error) {
        toast.error(data.error)
        setLoading(false)
        return
      }

      const counts = data?.counts || {}
      const parts: string[] = []
      for (const [key, value] of Object.entries(counts)) {
        if (Number(value) > 0 && TABLE_LABELS[key]) {
          parts.push(`${value} ${TABLE_LABELS[key]}`)
        }
      }
      const msg =
        parts.length > 0 ? `Excluído: ${parts.join(', ')}.` : 'Registro excluído permanentemente.'
      toast.success(msg)

      setOpen(false)
      onClose?.()
      navigate(redirectPath)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir registro.')
      setLoading(false)
    }
  }

  return (
    <>
      <Card className="border-red-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            Zona de perigo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-500">
            Remoção permanente e irreversível de todos os dados (LGPD)
          </p>
          <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir definitivamente
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) setConfirmText('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão permanente</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. Para confirmar, digite exatamente:{' '}
              <span className="font-bold text-red-600">{recordName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-text">Confirmação</Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={recordName}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!isMatch || loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir definitivamente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
