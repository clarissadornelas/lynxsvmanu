import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/avatar-utils'
import { Flame, Clock } from 'lucide-react'
import { SnoozePopover } from '@/components/SnoozePopover'
import type { FollowUpContact } from '@/services/follow-up-conversations'

const SENTIMENT_STYLES: Record<string, { dot: string; label: string }> = {
  positivo: { dot: 'bg-emerald-500', label: 'Positivo' },
  neutro: { dot: 'bg-gray-400', label: 'Neutro' },
  atencao: { dot: 'bg-amber-500', label: 'Atenção' },
  risco: { dot: 'bg-red-500', label: 'Risco' },
}

function formatDeadline(contatoAte: string | null): string | null {
  if (!contatoAte) return null
  const d = new Date(contatoAte)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function FollowUpListItem({
  contact,
  selected,
  onClick,
  highlightClass = 'bg-emerald-50',
  onSnoozeUpdated,
}: {
  contact: FollowUpContact
  selected: boolean
  onClick: () => void
  highlightClass?: string
  onSnoozeUpdated?: () => void
}) {
  const sentiment = contact.sentimento ? SENTIMENT_STYLES[contact.sentimento] : null
  const deadline = formatDeadline(contact.contato_ate)
  const neverContacted = contact.delay_days >= 9999
  const isDelayed = contact.delay_days > 0 && contact.delay_days < 9999
  const previewText = contact.ultima_mensagem_enviada || contact.ultima_mensagem
  const snoozeLabel = contact.is_snoozed
    ? `adiado até ${new Date(contact.adiado_ate!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
    : null

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
        selected ? highlightClass : 'hover:bg-slate-50',
      )}
    >
      <Avatar className="w-10 h-10 shrink-0 bg-muted">
        <AvatarImage src={contact.foto_url || undefined} />
        <AvatarFallback className="bg-muted text-xs font-semibold">
          {getInitials(contact.nome)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="font-medium text-sm text-slate-900 truncate">{contact.nome}</p>
          {contact.lead_quente && <Flame className="w-3 h-3 text-orange-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400">a cada {contact.cadencia_dias}d</span>
          {deadline && <span className="text-[10px] text-slate-400">· até {deadline}</span>}
          {sentiment && (
            <span className="flex items-center gap-0.5">
              <span className={cn('w-1.5 h-1.5 rounded-full', sentiment.dot)} />
              <span className="text-[10px] text-slate-500">{sentiment.label}</span>
            </span>
          )}
        </div>
        {previewText && <p className="text-xs text-slate-400 truncate">{previewText}</p>}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {snoozeLabel && (
          <Badge className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0">
            {snoozeLabel}
          </Badge>
        )}
        {!contact.is_snoozed && isDelayed && (
          <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0">
            {contact.delay_days}d
          </Badge>
        )}
        {!contact.is_snoozed && neverContacted && (
          <Badge className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0">Novo</Badge>
        )}
        {selected && (
          <SnoozePopover
            baseAtivaId={contact.id}
            currentDate={contact.adiado_ate}
            onUpdated={onSnoozeUpdated}
          >
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-slate-500">
              <Clock className="w-3 h-3" /> Adiar
            </Button>
          </SnoozePopover>
        )}
      </div>
    </button>
  )
}
