import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useActiveContext } from '@/stores/useActiveContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  Send,
  MessageSquare,
  Search,
  Play,
  Pause,
  UserCog,
  AlertCircle,
  ArrowLeft,
  Clock,
} from 'lucide-react'
import { getInitials } from '@/lib/avatar-utils'
import { fetchFollowUpContacts, type FollowUpContact } from '@/services/follow-up-conversations'
import { FollowUpListItem } from './FollowUpListItem'
import { SnoozePopover } from '@/components/SnoozePopover'

interface ConversationWithDetails {
  id: string
  candidato_id: string | null
  contato_id: string | null
  estado: string
  ultima_interacao: string
  criado_em: string
  nome: string
  foto_url: string | null
  ultima_mensagem: string | null
}

interface Mensagem {
  id: string
  direcao: string
  conteudo: string
  criado_em: string
  status: string
}

type ConsoleMode = 'agendamento' | 'follow_up'

const SENTIMENT_CHIPS = [
  { id: 'all', label: 'Todos' },
  { id: 'positivo', label: 'Positivo' },
  { id: 'neutro', label: 'Neutro' },
  { id: 'atencao', label: 'Atenção' },
  { id: 'risco', label: 'Em risco' },
]

export default function ConversationConsole() {
  const { tenantId } = useActiveContext()
  const [searchParams] = useSearchParams()
  const talentoParam = searchParams.get('talento')
  const ctxParam = searchParams.get('ctx')

  const [mode, setMode] = useState<ConsoleMode>('agendamento')
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [followUpContacts, setFollowUpContacts] = useState<FollowUpContact[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentimentFilter, setSentimentFilter] = useState('all')
  const initRef = useRef(false)

  const isFollowUp = mode === 'follow_up'
  const cs = isFollowUp
    ? {
        sel: 'bg-emerald-50',
        badge: 'bg-emerald-100 text-emerald-700',
        border: 'border-emerald-100',
        icon: 'text-emerald-600',
        label: 'Base Ativa',
      }
    : {
        sel: 'bg-indigo-50',
        badge: 'bg-indigo-100 text-indigo-700',
        border: 'border-slate-100',
        icon: 'text-indigo-600',
        label: 'Meu Assessor',
      }

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    if (ctxParam === 'follow_up') setMode('follow_up')
  }, [ctxParam])

  const loadConversations = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    const { data: convs, error: convErr } = await supabase
      .from('conversas')
      .select('id, candidato_id, contato_id, estado, ultima_interacao, criado_em')
      .eq('tenant_id', tenantId)
      .order('ultima_interacao', { ascending: false })
    if (convErr) {
      setError('Erro ao carregar conversas.')
      setLoading(false)
      return
    }
    if (!convs) {
      setLoading(false)
      return
    }
    const enriched: ConversationWithDetails[] = []
    for (const c of convs) {
      let nome = 'Contato'
      let foto_url: string | null = null
      if (c.candidato_id) {
        const { data: cand } = await supabase
          .from('candidatos')
          .select('nome, foto_url')
          .eq('id', c.candidato_id)
          .single()
        if (cand) {
          nome = cand.nome
          foto_url = cand.foto_url
        }
      } else if (c.contato_id) {
        const { data: contato } = await supabase
          .from('base_ativa')
          .select('nome')
          .eq('id', c.contato_id)
          .single()
        if (contato) nome = contato.nome
      }
      const { data: lastMsg } = await supabase
        .from('mensagens')
        .select('conteudo')
        .eq('conversa_id', c.id)
        .order('criado_em', { ascending: false })
        .limit(1)
        .single()
      enriched.push({ ...c, nome, foto_url, ultima_mensagem: lastMsg?.conteudo || null })
    }
    setConversations(enriched)
    setLoading(false)
  }, [tenantId])

  const loadFollowUpContacts = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const contacts = await fetchFollowUpContacts(tenantId)
      setFollowUpContacts(contacts)
    } catch {
      setError('Erro ao carregar contatos de follow-up.')
      setFollowUpContacts([])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    setSelectedId(null)
    setSelectedConvId(null)
    setMessages([])
    if (mode === 'agendamento') loadConversations()
    else loadFollowUpContacts()
  }, [mode, loadConversations, loadFollowUpContacts])

  useEffect(() => {
    if (isFollowUp && talentoParam && followUpContacts.length > 0) {
      setSelectedId(talentoParam)
    }
  }, [isFollowUp, talentoParam, followUpContacts])

  const loadMessages = useCallback(async (convId: string) => {
    const { data, error: msgErr } = await supabase
      .from('mensagens')
      .select('id, direcao, conteudo, criado_em, status')
      .eq('conversa_id', convId)
      .order('criado_em', { ascending: true })
    if (msgErr) {
      setError('Erro ao carregar mensagens.')
      return
    }
    setMessages(data || [])
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setSelectedConvId(null)
      setMessages([])
      return
    }
    if (mode === 'agendamento') {
      setSelectedConvId(selectedId)
      loadMessages(selectedId)
    } else {
      const contact = followUpContacts.find((c) => c.id === selectedId)
      const convId = contact?.conversa_id || null
      setSelectedConvId(convId)
      if (convId) loadMessages(convId)
      else setMessages([])
    }
  }, [selectedId, mode, followUpContacts, loadMessages])

  const handleSend = async () => {
    if (!input.trim() || !selectedConvId) return
    const content = input.trim()
    setInput('')
    setSending(true)
    if (isFollowUp) {
      await supabase.from('conversas').update({ contexto: 'follow_up' }).eq('id', selectedConvId)
    }
    const { data, error: sendErr } = await supabase
      .from('mensagens')
      .insert({
        conversa_id: selectedConvId,
        direcao: 'saida',
        conteudo: content,
        status: 'enviada',
      })
      .select('id, direcao, conteudo, criado_em, status')
      .single()
    if (sendErr) {
      setError('Erro ao enviar mensagem.')
      setSending(false)
      return
    }
    if (data) {
      setMessages((prev) => [...prev, data])
      if (!isFollowUp) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConvId
              ? { ...c, ultima_mensagem: content, ultima_interacao: new Date().toISOString() }
              : c,
          ),
        )
      } else {
        setFollowUpContacts((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, ultima_mensagem: content } : c)),
        )
      }
    }
    setSending(false)
  }

  const sentimentCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: followUpContacts.length,
      positivo: 0,
      neutro: 0,
      atencao: 0,
      risco: 0,
    }
    for (const c of followUpContacts) {
      if (c.sentimento && c.sentimento in counts) counts[c.sentimento]++
    }
    return counts
  }, [followUpContacts])

  const filtered = isFollowUp
    ? followUpContacts
        .filter((c) => (c.nome || '').toLowerCase().includes(search.toLowerCase()))
        .filter((c) => sentimentFilter === 'all' || c.sentimento === sentimentFilter)
    : conversations.filter((c) => c.nome.toLowerCase().includes(search.toLowerCase()))

  const selectedContact = isFollowUp ? followUpContacts.find((c) => c.id === selectedId) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="animate-pulse text-slate-400">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            onClick={() => setMode('agendamento')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              mode === 'agendamento'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            Agendamento
          </button>
          <button
            onClick={() => setMode('follow_up')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              mode === 'follow_up'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            Follow-up · Base Ativa
          </button>
        </div>
        <Badge className={cn('text-xs font-medium', cs.badge)}>{cs.label}</Badge>
        {isFollowUp && (
          <Button variant="ghost" size="sm" asChild className="text-slate-500">
            <Link to="/candidatos">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Base Ativa
            </Link>
          </Button>
        )}
        {error && (
          <span className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </span>
        )}
      </div>

      {isFollowUp && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {SENTIMENT_CHIPS.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setSentimentFilter(chip.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                sentimentFilter === chip.id
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
              )}
            >
              {chip.label}
              <span className="text-[10px] font-bold text-slate-400">
                {sentimentCounts[chip.id] || 0}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-4 flex-1 overflow-hidden">
        <Card className="w-80 shrink-0 flex flex-col border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className={cn('w-4 h-4', cs.icon)} />
              {mode === 'agendamento' ? 'Conversas' : 'Follow-ups'}
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="px-2 pb-2 space-y-1">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">
                  {mode === 'agendamento'
                    ? 'Nenhuma conversa encontrada'
                    : 'Nenhum follow-up encontrado'}
                </p>
              ) : mode === 'agendamento' ? (
                filtered.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
                      selectedId === conv.id ? cs.sel : 'hover:bg-slate-50',
                    )}
                  >
                    <Avatar className="w-10 h-10 shrink-0 bg-muted">
                      <AvatarImage src={conv.foto_url || undefined} />
                      <AvatarFallback className="bg-muted text-xs font-semibold">
                        {getInitials(conv.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900 truncate">{conv.nome}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {conv.ultima_mensagem || 'Sem mensagens'}
                      </p>
                    </div>
                    {conv.estado === 'novo' && (
                      <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0">
                        Novo
                      </Badge>
                    )}
                  </button>
                ))
              ) : (
                filtered.map((contact) => (
                  <FollowUpListItem
                    key={contact.id}
                    contact={contact}
                    selected={selectedId === contact.id}
                    onClick={() => setSelectedId(contact.id)}
                    highlightClass={cs.sel}
                    onSnoozeUpdated={loadFollowUpContacts}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        <Card className="flex-1 flex flex-col border-slate-200">
          <div className={cn('border-b p-3 flex items-center gap-2', cs.border)}>
            <Button variant="outline" size="sm" disabled>
              <Play className="w-3.5 h-3.5 mr-1" />
              Iniciar
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Pause className="w-3.5 h-3.5 mr-1" />
              Pausar
            </Button>
            <Button variant="outline" size="sm" disabled>
              <UserCog className="w-3.5 h-3.5 mr-1" />
              Assumir
            </Button>
            {isFollowUp && selectedContact && (
              <SnoozePopover
                baseAtivaId={selectedContact.id}
                currentDate={selectedContact.adiado_ate}
                onUpdated={loadFollowUpContacts}
              >
                <Button variant="outline" size="sm">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  Adiar até
                </Button>
              </SnoozePopover>
            )}
            <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto">
              <AlertCircle className="w-3.5 h-3.5" />
              WhatsApp required
            </span>
          </div>

          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-400 text-sm">Selecione uma conversa</p>
            </div>
          ) : !selectedConvId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Conversa não iniciada</p>
                <p className="text-slate-300 text-xs mt-1">
                  Inicie uma conversa para ver mensagens aqui
                </p>
              </div>
            </div>
          ) : (
            <>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-slate-400 text-sm">Sem mensagens</p>
                      </div>
                    ) : (
                      messages.map((m) => {
                        const isOutgoing = m.direcao === 'saida' || m.direcao === 'enviado'
                        return (
                          <div
                            key={m.id}
                            className={cn('flex', isOutgoing ? 'justify-end' : 'justify-start')}
                          >
                            <div
                              className={cn(
                                'max-w-[70%] rounded-lg px-4 py-2 text-sm',
                                isOutgoing
                                  ? isFollowUp
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 text-slate-800',
                                isOutgoing ? 'rounded-br-sm' : 'rounded-bl-sm',
                              )}
                            >
                              <p>{m.conteudo}</p>
                              <p
                                className={cn(
                                  'text-xs mt-1',
                                  isOutgoing
                                    ? isFollowUp
                                      ? 'text-emerald-200'
                                      : 'text-indigo-200'
                                    : 'text-slate-400',
                                )}
                              >
                                {new Date(m.criado_em).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
              <div className="border-t border-slate-100 p-3 flex gap-2">
                <Input
                  placeholder="Digite uma mensagem..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                />
                <Button size="icon" onClick={handleSend} disabled={!input.trim() || sending}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
