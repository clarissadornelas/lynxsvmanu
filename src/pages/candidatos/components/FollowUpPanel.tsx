import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Clock, Calendar, MessageSquare, Send, History, Sparkles, Info } from 'lucide-react'
import { getStatusInfo, formatDateBR, getNextContactDate } from '@/lib/cadence-utils'
import { isCycleExpired, getCycleStatusLabel } from '@/lib/talent-card-utils'

const CADENCE_OPTIONS = [7, 15, 30, 60, 90]
const SENTIMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'null', label: 'Não avaliado' },
  { value: 'positivo', label: 'Positivo · engajado' },
  { value: 'neutro', label: 'Neutro' },
  { value: 'atencao', label: 'Atenção · esfriando' },
  { value: 'risco', label: 'Em risco · pode sair' },
]

interface FollowUpPanelProps {
  talent: any
  open: boolean
  onOpenChange: (v: boolean) => void
  onRefresh?: () => void
}

export function FollowUpPanel({ talent, open, onOpenChange, onRefresh }: FollowUpPanelProps) {
  const [cadence, setCadence] = useState<string>(String(talent.cadencia_dias || 30))
  const [customCadence, setCustomCadence] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [contactMsg, setContactMsg] = useState('')
  const [registering, setRegistering] = useState(false)
  const [followUps, setFollowUps] = useState<any[]>([])
  const [conversaState, setConversaState] = useState<string | null>(null)
  const [contatoAte, setContatoAte] = useState<string>(talent.contato_ate || '')
  const [orientacaoAgente, setOrientacaoAgente] = useState<string>(talent.orientacao_agente || '')
  const [contextoRelacionamento, setContextoRelacionamento] = useState<string>(
    talent.contexto_relacionamento || '',
  )
  const [sentimento, setSentimento] = useState<string>(talent.sentimento || 'null')
  const [savingContext, setSavingContext] = useState(false)
  const [vinculoData, setVinculoData] = useState<{
    titulo: string | null
    data: string | null
  } | null>(null)
  const [adiadoAte, setAdiadoAte] = useState<string>(talent.adiado_ate || '')

  const loadData = useCallback(async () => {
    if (!talent?.id) return
    const [fuRes, convRes] = await Promise.all([
      talent.candidato_id
        ? supabase
            .from('follow_ups')
            .select('*')
            .eq('candidato_id', talent.candidato_id)
            .order('criado_em', { ascending: false })
        : Promise.resolve({ data: null, error: null }),
      supabase.from('conversas').select('estado').eq('contato_id', talent.id).maybeSingle(),
    ])
    if (fuRes.data) setFollowUps(fuRes.data)
    if (fuRes.error) toast.error('Erro ao carregar histórico de follow-ups.')
    if (convRes.data) setConversaState(convRes.data.estado)
  }, [talent])

  const loadVinculoData = useCallback(async () => {
    if (!talent?.candidato_id) {
      setVinculoData(null)
      return
    }
    const { data: cand, error } = await supabase
      .from('candidatos')
      .select('vaga_id, contratado_em, data_contratacao')
      .eq('id', talent.candidato_id)
      .single()
    if (error || !cand) {
      setVinculoData(null)
      return
    }
    let titulo: string | null = null
    if (cand.vaga_id) {
      const { data: vaga } = await supabase
        .from('vagas')
        .select('titulo')
        .eq('id', cand.vaga_id)
        .single()
      if (vaga) titulo = vaga.titulo
    }
    const data = cand.contratado_em || cand.data_contratacao || null
    if (titulo && data) {
      setVinculoData({ titulo, data })
    } else {
      setVinculoData(null)
    }
  }, [talent])

  useEffect(() => {
    if (open) {
      loadData()
      loadVinculoData()
      setContatoAte(talent.contato_ate || '')
      setOrientacaoAgente(talent.orientacao_agente || '')
      setContextoRelacionamento(talent.contexto_relacionamento || '')
      setSentimento(talent.sentimento || 'null')
      setAdiadoAte(talent.adiado_ate || '')
    }
  }, [open, loadData, loadVinculoData, talent])

  const status = getStatusInfo(talent)
  const nextDate = getNextContactDate(talent.ultimo_ping_em, talent.cadencia_dias)
  const isDelayed = nextDate && nextDate < new Date()
  const cycleExpired = isCycleExpired(talent.contato_ate)
  const cycleLabel = getCycleStatusLabel(talent.contato_ate)

  const saveCadence = async () => {
    const days = showCustom ? parseInt(customCadence) || 30 : parseInt(cadence)
    const { error } = await supabase
      .from('base_ativa')
      .update({ cadencia_dias: days })
      .eq('id', talent.id)
    if (error) {
      toast.error('Erro ao salvar cadência: ' + error.message)
      return
    }
    toast.success('Cadência atualizada!')
    onRefresh?.()
  }

  const saveSnooze = async () => {
    const { error } = await supabase
      .from('base_ativa')
      .update({ adiado_ate: adiadoAte || null })
      .eq('id', talent.id)
    if (error) {
      toast.error('Erro ao adiar follow-up: ' + error.message)
      return
    }
    toast.success(adiadoAte ? 'Follow-up adiado!' : 'Adiamento removido!')
    onRefresh?.()
  }

  const saveContext = async () => {
    setSavingContext(true)
    const sentimentoValue = sentimento === 'null' ? null : sentimento
    const { error } = await supabase
      .from('base_ativa')
      .update({
        contato_ate: contatoAte || null,
        orientacao_agente: orientacaoAgente || null,
        contexto_relacionamento: contextoRelacionamento || null,
        sentimento: sentimentoValue,
      })
      .eq('id', talent.id)
    if (error) {
      toast.error('Erro ao salvar contexto do relacionamento: ' + error.message)
      setSavingContext(false)
      return
    }
    toast.success('Contexto do relacionamento salvo!')
    setSavingContext(false)
    onRefresh?.()
  }

  const sugerirVinculo = () => {
    if (!vinculoData) return
    const dataFormatada = new Date(vinculoData.data).toLocaleDateString('pt-BR')
    const sugestao = `Contratado para a vaga ${vinculoData.titulo} em ${dataFormatada}. Acompanhamento de onboarding.`
    setContextoRelacionamento(sugestao)
    toast.success('Sugestão preenchida! Edite conforme necessário.')
  }

  const registerContact = async () => {
    if (!talent.candidato_id) {
      toast.error('Este talento não tem candidato vinculado. Não é possível registrar follow-up.')
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
      mensagem_enviada: contactMsg || null,
    })
    if (e2) {
      toast.error('Erro ao registrar follow-up: ' + e2.message)
      setRegistering(false)
      return
    }
    toast.success('Contato registrado com sucesso!')
    setRegistering(false)
    setContactMsg('')
    onRefresh?.()
    loadData()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {talent.nome}
            {cycleExpired ? (
              <Badge variant="secondary" className="bg-slate-200 text-slate-500 text-[10px]">
                Ciclo encerrado
              </Badge>
            ) : (
              <>
                <span className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                <span className={`text-xs font-normal ${status.textColor}`}>{status.label}</span>
              </>
            )}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Ciclo
              </span>
              <span
                className={`font-medium text-xs ${cycleExpired ? 'text-slate-400' : 'text-slate-600'}`}
              >
                {cycleLabel}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Último contato
              </span>
              <span className="font-medium">{formatDateBR(talent.ultimo_ping_em)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Próximo contato
              </span>
              <span
                className={`font-medium ${isDelayed ? 'text-red-600' : nextDate ? 'text-amber-600' : 'text-slate-400'}`}
              >
                {nextDate ? formatDateBR(nextDate.toISOString()) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pings enviados</span>
              <span className="font-medium">{talent.pings_enviados || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última resposta</span>
              <span className="font-medium">{formatDateBR(talent.ultima_resposta_em)}</span>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Contexto do Relacionamento
            </h4>
            <div className="space-y-2">
              <Label className="text-xs">Prazo de contato (contato até)</Label>
              <Input
                type="date"
                value={contatoAte}
                onChange={(e) => setContatoAte(e.target.value)}
                className="h-9"
              />
              {cycleExpired && (
                <p className="text-[11px] text-slate-400">
                  O ciclo está encerrado. Limpe o campo para remover o limite.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Contexto do relacionamento</Label>
              <Textarea
                placeholder="Ex.: Contratado como CFO na vaga Diretor Financeiro em 05/07/2026. Este follow-up acompanha o onboarding na empresa."
                rows={3}
                value={contextoRelacionamento}
                onChange={(e) => setContextoRelacionamento(e.target.value)}
              />
              {talent.candidato_id && vinculoData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sugerirVinculo}
                  className="text-xs w-full"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Sugerir do vínculo
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Direcionamento do agente na conversa</Label>
              <Textarea
                placeholder="Ex.: tom informal; perguntar como está a adaptação; lembrar que é follow-up de relacionamento, não abordagem de vaga."
                rows={2}
                value={orientacaoAgente}
                onChange={(e) => setOrientacaoAgente(e.target.value)}
              />
            </div>
            <div className="flex items-start gap-2 rounded-md bg-indigo-50/50 border border-indigo-100 p-2">
              <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                O agente lerá este contexto, a orientação e o histórico de contatos para retomar a
                conversa sem perder o fio. Hoje serve de guia para o contato manual.
              </p>
            </div>
            <Button size="sm" onClick={saveContext} disabled={savingContext} className="w-full">
              {savingContext ? 'Salvando...' : 'Salvar Contexto'}
            </Button>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Sentimento do Talento
            </h4>
            <div className="space-y-2">
              <Select value={sentimento} onValueChange={(v) => setSentimento(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SENTIMENT_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">
                Avaliação manual por enquanto; o agente atualizará a partir das conversas reais.
              </p>
            </div>
            <Button
              size="sm"
              onClick={saveContext}
              disabled={savingContext}
              variant="outline"
              className="w-full"
            >
              {savingContext ? 'Salvando...' : 'Salvar Sentimento'}
            </Button>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label className="text-xs">Cadência de contato</Label>
            <div className="flex gap-2">
              <Select
                value={showCustom ? 'custom' : cadence}
                onValueChange={(v) => {
                  if (v === 'custom') setShowCustom(true)
                  else {
                    setShowCustom(false)
                    setCadence(v)
                  }
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CADENCE_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      A cada {d} dias
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              {showCustom && (
                <Input
                  type="number"
                  placeholder="dias"
                  className="h-9 w-20"
                  value={customCadence}
                  onChange={(e) => setCustomCadence(e.target.value)}
                />
              )}
              <Button size="sm" onClick={saveCadence}>
                Salvar
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label className="text-xs">Adiar até (Snooze)</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={adiadoAte}
                onChange={(e) => setAdiadoAte(e.target.value)}
                className="h-9 flex-1"
              />
              <Button size="sm" onClick={saveSnooze}>
                Salvar
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              Adia o follow-up deste talento até a data especificada. Não será contado como
              atrasado.
            </p>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label className="text-xs">Registrar contato manual</Label>
            <Textarea
              placeholder="Mensagem enviada (opcional)..."
              rows={2}
              value={contactMsg}
              onChange={(e) => setContactMsg(e.target.value)}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full" disabled={registering}>
                  <Send className="w-3.5 h-3.5 mr-1" /> Registrar Contato
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {cycleExpired
                      ? 'O ciclo deste talento está encerrado. Registrar mesmo assim?'
                      : 'Confirmar registro de contato?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {cycleExpired
                      ? 'O prazo de contato (contato até) já passou. Você ainda pode registrar um contato manualmente.'
                      : 'Isso atualizará a data do último contato e incrementará o contador de pings.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={registerContact}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-muted-foreground">Estado da conversa:</span>
            {conversaState ? (
              <Badge variant="secondary" className="capitalize">
                {conversaState}
              </Badge>
            ) : (
              <Badge variant="outline">Sem conversa</Badge>
            )}
          </div>

          {talent.candidato_id && followUps.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> Histórico de follow-ups
              </Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {followUps.map((f) => (
                  <div key={f.id} className="text-xs border rounded-md p-2 bg-slate-50">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">Dia {f.dia_follow_up}</span>
                      <Badge
                        variant={f.status === 'enviado' ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {f.status}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground">{formatDateBR(f.data_enviado)}</span>
                    {f.mensagem_enviada && (
                      <p className="mt-1 text-slate-600 line-clamp-2">{f.mensagem_enviada}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
