import { useState } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Clock, Briefcase, CalendarClock, Settings, Send, MessageSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { getInitials } from '@/lib/avatar-utils'
import { getStatusInfo, formatDateShort } from '@/lib/cadence-utils'
import {
  SENTIMENT_CONFIG,
  getDaysSince,
  getDeadlineInfo,
  isCycleExpired,
} from '@/lib/talent-card-utils'
import { FollowUpPanel } from './FollowUpPanel'
import type { BaseAtivaWithRelations } from '@/types/recruitment'

export function TalentCard({
  talent,
  onRefresh,
}: {
  talent: BaseAtivaWithRelations
  onRefresh?: () => void
}) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [registering, setRegistering] = useState(false)

  const status = getStatusInfo(talent)
  const fotoUrl = talent.candidatos?.foto_url
  const sentiment = talent.sentimento ? SENTIMENT_CONFIG[talent.sentimento] : null
  const SentimentIcon = sentiment?.icon
  const deadline = getDeadlineInfo(talent.contato_ate)
  const cycleExpired = isCycleExpired(talent.contato_ate)

  const registerContact = async () => {
    if (!talent.candidato_id) {
      toast.error('Este talento não tem candidato vinculado. Não é possível registrar contato.')
      return
    }
    setRegistering(true)
    const { error: e1 } = await supabase
      .from('base_ativa')
      .update({
        ultimo_ping_em: new Date().toISOString(),
        pings_enviados: (talent.pings_enviados || 0) + 1,
      })
      .eq('id', talent.id)
    if (e1) {
      toast.error('Erro ao registrar contato: ' + e1.message)
      setRegistering(false)
      return
    }
    const { error: e2 } = await supabase.from('follow_ups').insert({
      candidato_id: talent.candidato_id,
      tenant_id: talent.tenant_id,
      data_agendada: new Date().toISOString().split('T')[0],
      data_enviado: new Date().toISOString(),
      dia_follow_up: (talent.pings_enviados || 0) + 1,
      status: 'enviado',
      mensagem_enviada: notes || null,
    })
    if (e2) {
      toast.error('Erro ao registrar follow-up: ' + e2.message)
      setRegistering(false)
      return
    }
    toast.success('Contato registrado com sucesso!')
    setRegistering(false)
    setRegisterOpen(false)
    setNotes('')
    onRefresh?.()
  }

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
          <CardContent className="flex-1 pt-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-3">
                <Avatar className="h-12 w-12 border bg-muted">
                  <AvatarImage src={fotoUrl || undefined} />
                  <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                    {getInitials(talent.nome)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{talent.nome}</h3>
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    <Briefcase className="w-3 h-3 mr-1" />
                    {talent.ultimo_cargo || 'Cargo Indefinido'}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {cycleExpired ? (
                  <Badge
                    variant="secondary"
                    className="bg-slate-200 text-slate-500 text-[10px] font-medium"
                  >
                    Ciclo encerrado
                  </Badge>
                ) : (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          <span className={`w-3 h-3 rounded-full inline-block ${status.color}`} />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Status do relacionamento: {status.label}</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className={`text-[10px] font-medium ${status.textColor}`}>
                      {status.label}
                    </span>
                  </>
                )}
              </div>
            </div>

            {sentiment && SentimentIcon && (
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium mb-3 ${sentiment.bgClass} ${sentiment.textColor}`}
              >
                <SentimentIcon className="w-3.5 h-3.5" />
                {sentiment.label}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap gap-1 text-xs">
                {talent.nivel && (
                  <Badge variant="secondary" className="font-medium">
                    {talent.nivel}
                  </Badge>
                )}
                {talent.nicho && <Badge variant="outline">{talent.nicho}</Badge>}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span onClick={() => setPanelOpen(true)} className="cursor-pointer">
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1 hover:bg-slate-100 transition-colors"
                      >
                        <CalendarClock className="w-3 h-3" /> a cada {talent.cadencia_dias}d
                        {talent.contato_ate && (
                          <span className={deadline.isOverdue ? 'text-red-600 font-medium' : ''}>
                            {' · até '}
                            {formatDateShort(talent.contato_ate)}
                          </span>
                        )}
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clique para configurar cadência e prazo de contato</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border rounded-md p-2 bg-slate-50 mt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <span className="text-muted-foreground block mb-0.5">Status CRM</span>
                      <span className="font-medium capitalize">{talent.status_profissional}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Status profissional atual do talento no CRM</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <span className="text-muted-foreground block mb-0.5">Último Ping</span>
                      <span className="font-medium flex items-center text-slate-700">
                        <Clock className="w-3 h-3 mr-1" /> {getDaysSince(talent.ultimo_ping_em)}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {talent.ultimo_ping_em
                        ? `Último contato: ${new Date(talent.ultimo_ping_em).toLocaleDateString('pt-BR')}`
                        : 'Nenhum contato realizado ainda'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {talent.orientacao_agente && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-xs border-l-2 border-indigo-300 pl-2 italic text-slate-600 cursor-help line-clamp-2">
                      {talent.orientacao_agente}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Orientação do agente: {talent.orientacao_agente}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </CardContent>
          <CardFooter className="p-3 border-t gap-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1 text-xs font-semibold"
              onClick={() => setRegisterOpen(true)}
              disabled={!talent.candidato_id || registering}
            >
              <Send className="w-3.5 h-3.5 mr-1" /> Registrar contato
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground shrink-0"
              asChild
            >
              <Link to={`/conversas?ctx=follow_up&talento=${talent.id}`}>
                <MessageSquare className="w-3.5 h-3.5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground shrink-0"
              onClick={() => setPanelOpen(true)}
            >
              <Settings className="w-3.5 h-3.5 mr-1" /> Configurar
            </Button>
          </CardFooter>
        </Card>
      </TooltipProvider>

      <AlertDialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cycleExpired ? 'Ciclo encerrado — registrar contato?' : 'Registrar contato'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cycleExpired ? (
                <>
                  O ciclo deste talento está encerrado. Registrar mesmo assim? Isso atualizará a
                  data do último contato e incrementará o contador de pings.
                </>
              ) : (
                <>
                  Confirma o registro de contato com {talent.nome || 'este talento'}? Isso
                  atualizará a data do último contato e incrementará o contador de pings.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Textarea
              placeholder="Notas (opcional)..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={registering}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                registerContact()
              }}
              disabled={registering}
            >
              {registering ? 'Registrando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FollowUpPanel
        talent={talent}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onRefresh={onRefresh}
      />
    </>
  )
}
