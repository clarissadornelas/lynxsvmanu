import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CandidateAnalyticSummary } from '@/components/CandidateAnalyticSummary'
import { PageHeader } from '@/components/PageHeader'
import { getInitials } from '@/lib/avatar-utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  ChevronLeft,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  MessageCircle,
  Bot,
  FileText,
  Linkedin,
  Briefcase,
  Building2,
  Clock,
  CheckCircle2,
  User,
  Camera,
  Loader2,
  UserX,
  RotateCcw,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AddToBaseDialog } from './components/AddToBaseDialog'
import { DangerZone } from '@/components/DangerZone'

interface CandidatoEvento {
  id: string
  tipo: string | null
  de: string | null
  para: string | null
  agente: string | null
  criado_em: string
}

export default function CandidateProfile() {
  const { id } = useParams<{ id: string }>()
  const [candidate, setCandidate] = useState<any>(null)
  const [job, setJob] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [interviews, setInterviews] = useState<any[]>([])
  const [eventos, setEventos] = useState<CandidatoEvento[]>([])
  const [loading, setLoading] = useState(true)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [alreadyInBase, setAlreadyInBase] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const handleInactivate = async () => {
    if (!candidate) return
    try {
      const prevStatus = candidate.status || 'novo'
      const { error } = await supabase
        .from('candidatos')
        .update({ status: 'inativo' })
        .eq('id', candidate.id)
      if (error) throw error

      await supabase.from('candidato_eventos').insert({
        candidato_id: candidate.id,
        tipo: 'mudanca_fase',
        de: prevStatus,
        para: 'inativo',
        agente: 'assessor',
        ator: 'operador',
        tenant_id: candidate.tenant_id,
        vaga_id: candidate.vaga_id || null,
      })

      toast.success('Candidato inativado e removido do funil ativo.')
      setCandidate({ ...candidate, status: 'inativo' })
    } catch {
      toast.error('Erro ao inativar candidato.')
    }
  }

  const handleReactivate = async () => {
    if (!candidate) return
    try {
      const prevStatus = candidate.status || 'inativo'
      const { error } = await supabase
        .from('candidatos')
        .update({ status: 'novo' })
        .eq('id', candidate.id)
      if (error) throw error

      await supabase.from('candidato_eventos').insert({
        candidato_id: candidate.id,
        tipo: 'mudanca_fase',
        de: prevStatus,
        para: 'novo',
        agente: 'assessor',
        ator: 'operador',
        tenant_id: candidate.tenant_id,
        vaga_id: candidate.vaga_id || null,
      })

      toast.success('Candidato reativado e movido para "A Triar".')
      setCandidate({ ...candidate, status: 'novo' })
    } catch {
      toast.error('Erro ao reativar candidato.')
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !candidate) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.')
      return
    }
    setPhotoUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${candidate.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('fotos-candidatos')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const {
        data: { publicUrl },
      } = supabase.storage.from('fotos-candidatos').getPublicUrl(path)
      await supabase.from('candidatos').update({ foto_url: publicUrl }).eq('id', candidate.id)
      setCandidate({ ...candidate, foto_url: publicUrl })
      toast.success('Foto atualizada!')
    } catch {
      toast.error('Erro ao enviar foto.')
    }
    setPhotoUploading(false)
    e.target.value = ''
  }

  useEffect(() => {
    const fetchCandidate = async () => {
      if (!id) return
      setLoading(true)

      const { data: cand } = await supabase
        .from('candidatos')
        .select('*, vagas(*), entrevistas(*)')
        .eq('id', id)
        .single()

      if (cand) {
        setCandidate(cand)
        setTenantId(cand.tenant_id)
        if (cand.vagas) setJob(cand.vagas)
        if (cand.entrevistas) setInterviews(cand.entrevistas)

        const { data: existingBase } = await supabase
          .from('base_ativa')
          .select('id')
          .eq('candidato_id', id)
          .maybeSingle()
        setAlreadyInBase(!!existingBase)

        const [convRes, eventosRes] = await Promise.all([
          supabase.from('conversas').select('id').eq('candidato_id', id),
          supabase
            .from('candidato_eventos')
            .select('id, tipo, de, para, agente, criado_em')
            .eq('candidato_id', id)
            .order('criado_em', { ascending: false }),
        ])

        if (convRes.data && convRes.data.length > 0) {
          const { data: msgs } = await supabase
            .from('mensagens')
            .select('*')
            .in(
              'conversa_id',
              convRes.data.map((c) => c.id),
            )
            .order('criado_em', { ascending: true })

          if (msgs) setMessages(msgs)
        }

        if (eventosRes.data) setEventos(eventosRes.data as CandidatoEvento[])
      }
      setLoading(false)
    }
    fetchCandidate()
  }, [id])

  if (loading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Carregando perfil...</div>
  }

  if (!candidate) {
    return <div className="p-8 text-center text-slate-500">Candidato não encontrado.</div>
  }

  const latestDisc = interviews.find((i) => i.disc)?.disc
  const analyzedEntrevista = interviews.find(
    (i) => i.status === 'analisada' || i.status === 'entregue',
  )
  const completedEntrevista = interviews.find(
    (i) => i.realizada_em || ['realizada', 'analisada', 'entregue'].includes(i.status),
  )
  let analyzedReport: any = null
  try {
    analyzedReport = analyzedEntrevista?.resumo ? JSON.parse(analyzedEntrevista.resumo) : null
  } catch {
    analyzedReport = null
  }
  let parsedDadosAdicionais: Record<string, any> = {}
  try {
    parsedDadosAdicionais = candidate.dados_adicionais ? JSON.parse(candidate.dados_adicionais) : {}
  } catch {
    parsedDadosAdicionais = {}
  }
  const ultimaEntrevistaMeta = parsedDadosAdicionais.ultima_entrevista || null

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-fade-in-up">
      <PageHeader title={candidate.nome} subtitle={`Vaga: ${job?.titulo || 'Nenhuma'}`}>
        <Link to={job ? `/vagas/${job.id}` : '/candidatos'}>
          <Button variant="ghost" size="icon" className="bg-white border border-slate-200">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
        <AddToBaseDialog
          candidatoId={candidate.id}
          nome={candidate.nome}
          email={candidate.email}
          telefone={candidate.telefone}
          empresaAtual={candidate.empresa}
          ultimoCargo={candidate.cargo}
          tenantId={tenantId}
          alreadyInBase={alreadyInBase}
          onSuccess={() => setAlreadyInBase(true)}
          triggerVariant="profile"
        />
      </PageHeader>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <Avatar className="w-24 h-24 border-4 border-slate-50 shadow-sm">
                  <AvatarImage src={candidate.foto_url || undefined} />
                  <AvatarFallback className="bg-muted text-2xl font-bold text-muted-foreground">
                    {getInitials(candidate.nome)}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md hover:bg-indigo-700 transition-colors"
                  disabled={photoUploading}
                >
                  {photoUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
              <h2 className="font-semibold text-lg">{candidate.nome}</h2>
              <Badge variant="outline" className="mb-4 capitalize">
                {candidate.status}
              </Badge>

              <div className="space-y-3 text-sm text-left bg-slate-50 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-slate-600 truncate">
                  <Mail className="w-4 h-4 shrink-0" />{' '}
                  <span className="truncate">{candidate.email || 'Sem email'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 shrink-0" />{' '}
                  <span>{candidate.telefone || 'Sem telefone'}</span>
                </div>
                {candidate.linkedin && (
                  <div className="flex items-center gap-2 text-slate-600 truncate">
                    <Linkedin className="w-4 h-4 shrink-0" />{' '}
                    <a
                      href={candidate.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-blue-600 hover:underline"
                    >
                      {candidate.linkedin}
                    </a>
                  </div>
                )}
                {candidate.cargo && (
                  <div className="flex items-center gap-2 text-slate-600 truncate">
                    <Briefcase className="w-4 h-4 shrink-0" />{' '}
                    <span className="truncate">{candidate.cargo}</span>
                  </div>
                )}
                {candidate.empresa && (
                  <div className="flex items-center gap-2 text-slate-600 truncate">
                    <Building2 className="w-4 h-4 shrink-0" />{' '}
                    <span className="truncate">{candidate.empresa}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {latestDisc && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Perfil DISC
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="font-bold text-center text-xl text-indigo-700 bg-indigo-50 py-2 rounded-lg">
                  {typeof latestDisc.perfil === 'string'
                    ? latestDisc.perfil
                    : typeof latestDisc.profile === 'string'
                      ? latestDisc.profile
                      : 'DISC'}
                </div>
                <div className="space-y-1 mt-2">
                  <div className="flex justify-between">
                    <span>Dominância:</span>{' '}
                    <span className="font-medium">
                      {latestDisc.detalhes?.D ?? latestDisc.perfil?.D ?? latestDisc.D ?? 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Influência:</span>{' '}
                    <span className="font-medium">
                      {latestDisc.detalhes?.I ?? latestDisc.perfil?.I ?? latestDisc.I ?? 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estabilidade:</span>{' '}
                    <span className="font-medium">
                      {latestDisc.detalhes?.S ?? latestDisc.perfil?.S ?? latestDisc.S ?? 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Conformidade:</span>{' '}
                    <span className="font-medium">
                      {latestDisc.detalhes?.C ?? latestDisc.perfil?.C ?? latestDisc.C ?? 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {completedEntrevista && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Entrevista Realizada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {completedEntrevista.realizada_em && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>
                      {new Date(completedEntrevista.realizada_em).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
                {ultimaEntrevistaMeta?.realizada_por_nome && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <User className="w-4 h-4 shrink-0" />
                    <span>{ultimaEntrevistaMeta.realizada_por_nome}</span>
                  </div>
                )}
                {ultimaEntrevistaMeta?.transcricao_preview && (
                  <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600 line-clamp-3">
                    {ultimaEntrevistaMeta.transcricao_preview}
                  </div>
                )}
                {analyzedEntrevista && analyzedReport && (
                  <>
                    <div className="border-t border-slate-100 my-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Score pós-entrevista</span>
                      <Badge variant="outline" className="font-bold">
                        {candidate.score ? `${candidate.score}%` : 'N/A'}
                      </Badge>
                    </div>
                    {analyzedReport.recommendation && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Recomendação IA</span>
                        <Badge variant="secondary">{analyzedReport.recommendation}</Badge>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full justify-start bg-[#25D366] hover:bg-[#128C7E] text-white"
                variant="default"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp Manual
              </Button>
              <Button
                className="w-full justify-start text-blue-600 bg-blue-50 hover:bg-blue-100"
                variant="secondary"
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Forçar Agendamento
              </Button>
              <Link
                to={`/entrevistas/nova?candidato=${candidate.id}&vaga=${candidate.vaga_id || ''}`}
              >
                <Button
                  className="w-full justify-start text-indigo-600 bg-indigo-50 hover:bg-indigo-100 mt-2"
                  variant="secondary"
                >
                  <Bot className="w-4 h-4 mr-2" />
                  Copilot de Entrevista
                </Button>
              </Link>
              <div className="pt-2">
                <AddToBaseDialog
                  candidatoId={candidate.id}
                  nome={candidate.nome}
                  email={candidate.email}
                  telefone={candidate.telefone}
                  empresaAtual={candidate.empresa}
                  ultimoCargo={candidate.cargo}
                  tenantId={tenantId}
                  alreadyInBase={alreadyInBase}
                  onSuccess={() => setAlreadyInBase(true)}
                  triggerVariant="profile"
                />
              </div>
              {candidate.status === 'inativo' ? (
                <Button
                  className="w-full justify-start text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                  variant="secondary"
                  onClick={handleReactivate}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reativar Candidato
                </Button>
              ) : (
                <Button
                  className="w-full justify-start text-slate-600 bg-slate-100 hover:bg-slate-200"
                  variant="secondary"
                  onClick={handleInactivate}
                >
                  <UserX className="w-4 h-4 mr-2" />
                  Inativar Candidato
                </Button>
              )}
            </CardContent>
          </Card>

          <DangerZone
            tipo="candidato"
            recordId={candidate.id}
            recordName={candidate.nome || ''}
            redirectPath="/candidatos"
          />
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Currículo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {candidate.cv_texto ? (
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {candidate.cv_texto}
                </p>
              ) : (
                <p className="text-sm text-slate-500 italic">
                  Sem currículo cadastrado. Candidatos adicionados antes da ingestão de CV não têm
                  este texto.
                </p>
              )}
            </CardContent>
          </Card>

          <CandidateAnalyticSummary
            dadosAdicionais={candidate.dados_adicionais}
            resumoEntrevista={analyzedEntrevista?.resumo}
          />

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Linha do tempo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {eventos.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-4">
                  Sem eventos registrados ainda.
                </p>
              ) : (
                <div className="space-y-4">
                  {eventos.map((evento) => (
                    <div
                      key={evento.id}
                      className="flex gap-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900 capitalize">
                            {evento.tipo || 'Evento'}
                          </span>
                          <span className="text-xs text-slate-400 font-mono shrink-0">
                            {format(new Date(evento.criado_em), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        {(evento.de || evento.para) && (
                          <p className="text-sm text-slate-600 mt-1">
                            {evento.tipo || 'Evento'}: {evento.de || '—'} -&gt; {evento.para || '—'}
                          </p>
                        )}
                        {evento.agente && (
                          <p className="text-xs text-slate-400 mt-1">({evento.agente})</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-full border-slate-200 shadow-sm min-h-[400px]">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-600" />
                Histórico de Interações (CRM)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-6 space-y-8 relative before:absolute before:inset-0 before:ml-8 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-200">
                {messages.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 relative z-10 bg-white mx-auto w-3/4">
                    Nenhuma interação registrada.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOut = msg.direcao === 'saida'
                    return (
                      <div
                        key={msg.id}
                        className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group`}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-indigo-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          {isOut ? (
                            <Bot className="w-4 h-4" />
                          ) : (
                            <MessageCircle className="w-4 h-4" />
                          )}
                        </div>

                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm text-slate-900">
                              {isOut ? 'IA Headhunter' : candidate.nome}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              {format(new Date(msg.criado_em), "dd/MM 'às' HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                          <p
                            className={`text-sm ${isOut ? 'text-slate-500 italic' : 'text-slate-700 whitespace-pre-wrap'}`}
                          >
                            {msg.conteudo}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
