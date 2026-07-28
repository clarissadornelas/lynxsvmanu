import { useState, ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function SnoozePopover({
  baseAtivaId,
  currentDate,
  onUpdated,
  children,
}: {
  baseAtivaId: string
  currentDate: string | null
  onUpdated?: () => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(currentDate || '')

  const handleSave = async () => {
    const { error } = await supabase
      .from('base_ativa')
      .update({ adiado_ate: date || null })
      .eq('id', baseAtivaId)
    if (error) {
      toast.error('Erro ao adiar follow-up: ' + error.message)
      return
    }
    toast.success(date ? 'Follow-up adiado!' : 'Adiamento removido!')
    setOpen(false)
    onUpdated?.()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700">Adiar até</p>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9"
          />
          <Button size="sm" className="w-full" onClick={handleSave}>
            Salvar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
