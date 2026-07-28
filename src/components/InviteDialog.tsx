import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Copy } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inviteText: string
}

export function InviteDialog({ open, onOpenChange, inviteText }: InviteDialogProps) {
  const { toast } = useToast()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteText)
    toast({ title: 'Convite copiado para a área de transferência!' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convite pronto</DialogTitle>
        </DialogHeader>
        <Textarea readOnly value={inviteText} className="min-h-[160px] text-sm" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleCopy} className="gap-2">
            <Copy className="w-4 h-4" />
            Copiar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
