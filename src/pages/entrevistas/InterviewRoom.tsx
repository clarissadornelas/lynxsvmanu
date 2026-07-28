import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { CandidateAnalyticSummary } from '@/components/CandidateAnalyticSummary'
import { DiscBadge } from '@/components/DiscBadge'
import { RefinarBloco } from '@/components/entrevistas/RefinarBloco'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import {
  Bot,
  Loader2,
  FileText,
  CheckCircle2,
  Activity,
  Download,
  Check,
  X,
  Clock,
  Video,
  PhoneOff,
  AlertTriangle,
  Copy,
} from 'lucide-react'
import { toast } from 'sonner'

export default function InterviewRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [entrevista, setEntrevista] = useState<any>(null)
  const [vaga, setVaga] = useState<any>(null)
  const [candidato, setCandidato] = useState<any>(null)
  const [agendamento, setAgendamento] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [notas, setNotas] = useState('')
  const [localStatus, setLocalStatus] = useState<'idle' | 'in_progress'>('idle')
  const [realizadaPor, setRealizadaPor] = useState<{ nome: string } | null>(null)
  const { user } = useAuth()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    async function load() {
      if (!id) return
      const { data: ent, error } = await supabase
        .from('entrevistas')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error || !ent) {
        toast.error('Entrevista não encontrada')
        navigate('/entrevistas')
        return
      }
      setEntrevista(ent)
      setNotas(ent.notas || '')
      setTranscript(ent.transcricao || '')
      const { data: v } = await supabase
        .from('vagas')
        .select('*')
        .eq('id', ent.vaga_id)
        .maybeSingle()
      const { data: c } = await supabase
        .from('candidatos')
        .select('*')
        .eq('id', ent.candidato_id)
        .maybeSingle()
      setVaga(v)
      setCandidato(c)
      if (ent.realizada_por_id) {
        const { data: ru } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', ent.realizada_por_id)
          .maybeSingle()
        if (ru) setRealizadaPor(ru)
      }
      if (ent.agendamento_id) {
        const { data: ag } = await supabase
          .from('agendamentos')
          .select('*')
          .eq('id', ent.agendamento_id)
          .maybeSingle()
        setAgendamento(ag)
      }
      setLoading(false)
    }
    load()
  }, [id, navigate])

  useEffect(() => {
    if (entrevista?.status !== 'em_analise') return
    const interval = setInterval(async () => {
      const { data } = await supabase.from('entrevistas').select('*').eq('id', id).maybeSingle()
      if (data && data.status !== 'em_analise') {
        setEntrevista(data)
        if (data.candidato_id) {
          const { data: c } = await supabase
            .from('candidatos')
            .select('*')
            .eq('id', data.candidato_id)
            .maybeSingle()
          if (c) setCandidato(c)
        }
        toast.success('Análise concluída!')
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [entrevista?.status, id])

  const gerarPrep = async () => {
    if (!entrevista || !vaga || !candidato) return
    setGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('copilot-generate-prep', {
        body: { entrevista_id: id, vaga_id: vaga.id, candidato_id: candidato.id },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setEntrevista({ ...entrevista, roteiro: JSON.stringify(data), status: 'roteiro_pronto' })
      toast.success('Roteiro gerado com IA!')
    } catch (err: any) {
      const errMsg = err.message || ''
      if (
        err instanceof TypeError ||
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('Relay Error')
      ) {
        toast.error(
          'Erro de conexão: Não foi possível alcançar o serviço de IA. Verifique sua internet ou tente novamente mais tarde.',
        )
      } else if (errMsg.includes('Chave de IA não configurada')) {
        toast.error(
          'Chave de IA não configurada. Por favor, acesse as Configurações para cadastrar sua chave de API.',
          {
            duration: 8000,
            action: {
              label: 'Ir para Configurações',
              onClick: () => navigate('/configuracoes'),
            },
          },
        )
      } else {
        toast.error(errMsg || 'Erro ao gerar roteiro')
      }
    }
    setGenerating(false)
  }

  const refinarRoteiro = async (instrucoes: string) => {
    if (!entrevista || !vaga || !candidato) return
    try {
      const { data, error } = await supabase.functions.invoke('copilot-generate-prep', {
        body: {
          entrevista_id: id,
          vaga_id: vaga.id,
          candidato_id: candidato.id,
          instrucoes,
          refinar: true,
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setEntrevista({ ...entrevista, roteiro: JSON.stringify(data) })
      toast.success('Roteiro atualizado')
    } catch (err: any) {
      const errMsg = err.message || ''
      if (
        err instanceof TypeError ||
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('Relay Error')
      ) {
        toast.error(
          'Erro de conexão: Não foi possível alcançar o serviço de IA. Verifique sua internet ou tente novamente mais tarde.',
        )
      } else {
        toast.error(errMsg || 'Erro ao refinar roteiro')
      }
      throw err
    }
  }

  const refinarAnalise = async (instrucoes: string) => {
    if (!entrevista) return
    try {
      const { data, error } = await supabase.functions.invoke('copilot-analyze-interview', {
        body: { entrevista_id: id, instrucoes, refinar: true },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const { data: refreshed } = await supabase
        .from('entrevistas')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (refreshed) setEntrevista(refreshed)
      const { data: c } = await supabase
        .from('candidatos')
        .select('*')
        .eq('id', refreshed?.candidato_id || entrevista.candidato_id)
        .maybeSingle()
      if (c) setCandidato(c)
      toast.success('Análise atualizada')
    } catch (err: any) {
      const errMsg = err.message || ''
      if (
        err instanceof TypeError ||
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('Relay Error')
      ) {
        toast.error(
          'Erro de conexão: Não foi possível alcançar o serviço de IA. Verifique sua internet ou tente novamente mais tarde.',
        )
      } else {
        toast.error(errMsg || 'Erro ao refinar análise')
      }
      throw err
    }
  }

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setLocalStatus('in_progress')
      toast.info('Videochamada iniciada.')
    } catch {
      toast.error('Erro ao acessar câmera/microfone.')
    }
  }

  const endCall = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    setLocalStatus('idle')
  }

  const confirmarEntrevista = async () => {
    if (!entrevista) return
    if (transcript.length < 100) {
      toast.error('A transcrição deve ter no mínimo 100 caracteres.')
      return
    }
    setAnalyzing(true)
    try {
      const now = new Date().toISOString()
      let realizadaPorId: string | null = null
      let realizadaPorNome: string | null = null
      if (user?.email) {
        const { data: usr } = await supabase
          .from('usuarios')
          .select('id, nome')
          .eq('email', user.email)
          .maybeSingle()
        if (usr) {
          realizadaPorId = usr.id
          realizadaPorNome = usr.nome
        }
      }

      let agendamentoId = entrevista.agendamento_id

      const { data: activeAgs, error: bulkSearchError } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('candidato_id', entrevista.candidato_id)
        .eq('vaga_id', entrevista.vaga_id)
        .in('status', ['agendada', 'confirmada', 'em_andamento'])
        .order('agendada_para', { ascending: false })

      if (bulkSearchError) {
        toast.error('Erro ao buscar agendamentos ativos.')
        setAnalyzing(false)
        return
      }

      if (!agendamentoId && activeAgs && activeAgs.length > 0) {
        agendamentoId = activeAgs[0].id
      }

      if (activeAgs && activeAgs.length > 0) {
        const { error: bulkUpdateError } = await supabase
          .from('agendamentos')
          .update({ status: 'realizada' })
          .in(
            'id',
            activeAgs.map((a) => a.id),
          )

        if (bulkUpdateError) {
          toast.error('Erro ao atualizar agendamentos ativos.')
          setAnalyzing(false)
          return
        }
      }

      const transcricaoPreview = transcript.substring(0, 1000)
      const parecerPreview = transcript.substring(0, 2000)

      if (agendamentoId) {
        const { error: agUpdateError } = await supabase
          .from('agendamentos')
          .update({ status: 'realizada', parecer: parecerPreview })
          .eq('id', agendamentoId)

        if (agUpdateError) {
          toast.error('Erro ao atualizar o agendamento principal.')
          setAnalyzing(false)
          return
        }
      }

      const { error: entUpdateError } = await supabase
        .from('entrevistas')
        .update({
          transcricao: transcript,
          status: 'concluida',
          realizada_em: now,
          realizada_por_id: realizadaPorId,
          agendamento_id: agendamentoId,
        })
        .eq('id', id)

      if (entUpdateError) {
        toast.error('Erro ao atualizar a entrevista.')
        setAnalyzing(false)
        return
      }

      const { error: candUpdateError } = await supabase
        .from('candidatos')
        .update({ status: 'entrevistado' })
        .eq('id', entrevista.candidato_id)

      if (candUpdateError) {
        toast.error('Erro ao atualizar o candidato.')
        setAnalyzing(false)
        return
      }

      const { error: eventoError } = await supabase.from('candidato_eventos').insert({
        candidato_id: entrevista.candidato_id,
        vaga_id: entrevista.vaga_id,
        tenant_id: entrevista.tenant_id,
        tipo: 'entrevista_realizada',
        de: 'agendado',
        para: 'entrevistado',
        agente: 'copiloto',
        ator: 'operador',
        payload: { entrevista_id: id, agendamento_id: agendamentoId, realizada_em: now },
      })

      if (eventoError) {
        console.error('Erro ao inserir candidato_eventos:', eventoError)
      }

      const { data: candAtual } = await supabase
        .from('candidatos')
        .select('dados_adicionais')
        .eq('id', entrevista.candidato_id)
        .maybeSingle()

      let dadosAdicionais: Record<string, any> = {}
      try {
        dadosAdicionais = candAtual?.dados_adicionais ? JSON.parse(candAtual.dados_adicionais) : {}
      } catch {
        dadosAdicionais = {}
      }

      dadosAdicionais.ultima_entrevista = {
        ...(dadosAdicionais.ultima_entrevista || {}),
        entrevista_id: id,
        agendamento_id: agendamentoId,
        realizada_em: now,
        realizada_por_id: realizadaPorId,
        realizada_por_nome: realizadaPorNome,
        transcricao_registrada: true,
        transcricao_preview: transcricaoPreview,
      }

      const { error: dadosUpdateError } = await supabase
        .from('candidatos')
        .update({ dados_adicionais: JSON.stringify(dadosAdicionais) })
        .eq('id', entrevista.candidato_id)

      if (dadosUpdateError) {
        toast.error('Erro ao salvar metadados do candidato.')
        setAnalyzing(false)
        return
      }

      if (realizadaPorNome) setRealizadaPor({ nome: realizadaPorNome })

      toast.success('Entrevista confirmada com sucesso!')

      const updatedEntrevista = {
        ...entrevista,
        transcricao: transcript,
        status: 'concluida',
        realizada_em: now,
        realizada_por_id: realizadaPorId,
        agendamento_id: agendamentoId,
      }
      setEntrevista(updatedEntrevista)

      const { error: emAnaliseError } = await supabase
        .from('entrevistas')
        .update({ status: 'em_analise' })
        .eq('id', id)

      if (emAnaliseError) {
        console.error('Erro ao atualizar status para em_analise:', emAnaliseError)
      } else {
        setEntrevista({ ...updatedEntrevista, status: 'em_analise' })
      }

      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        'copilot-analyze-interview',
        { body: { entrevista_id: id } },
      )
      if (aiError || aiData?.error) {
        await supabase.from('entrevistas').update({ status: 'concluida' }).eq('id', id)
        setEntrevista({ ...updatedEntrevista, status: 'concluida' })
        const confirmAiErrMsg = aiError?.message || aiData?.error || ''
        if (
          aiError instanceof TypeError ||
          confirmAiErrMsg.includes('Failed to fetch') ||
          confirmAiErrMsg.includes('Relay Error')
        ) {
          toast.error(
            'Erro de conexão: Não foi possível alcançar o serviço de IA. Verifique sua internet ou tente novamente mais tarde.',
          )
        } else {
          toast.error(
            'Entrevista registrada. A análise da IA falhou e pode ser executada novamente.',
          )
        }
      } else {
        toast.success('Análise iniciada! Aguarde...')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar entrevista')
      await supabase.from('entrevistas').update({ status: 'concluida' }).eq('id', id)
      setEntrevista({
        ...entrevista,
        transcricao: transcript,
        status: 'concluida',
        realizada_em: new Date().toISOString(),
      })
    }
    setAnalyzing(false)
  }

  const saveNotas = async () => {
    await supabase.from('entrevistas').update({ notas }).eq('id', id)
    toast.success('Anotações salvas!')
  }

  const downloadTranscript = () => {
    if (!entrevista.transcricao) return
    const element = document.createElement('a')
    const file = new Blob([entrevista.transcricao], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `transcricao_${candidato?.nome?.replace(/\s+/g, '_')}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const handleFinalize = async (recommendation: string) => {
    if (!entrevista || !candidato) return
    setAnalyzing(true)
    const crmStatus =
      recommendation === 'Aprovado'
        ? 'entrevistado'
        : recommendation === 'Reprovado'
          ? 'reprovado'
          : 'entrevistado'
    await supabase.from('candidatos').update({ status: crmStatus }).eq('id', candidato.id)
    await supabase.from('entrevistas').update({ status: 'entregue' }).eq('id', id)
    setEntrevista({ ...entrevista, status: 'entregue' })
    toast.success('Recomendação finalizada e CRM atualizado!')
    setAnalyzing(false)
    navigate('/entrevistas')
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    }
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    )
  }

  let roteiroObj: any = null
  let parsedCategories: any[] = []
  let briefing = ''
  let redFlags: string[] = []
  try {
    roteiroObj =
      typeof entrevista.roteiro === 'string' ? JSON.parse(entrevista.roteiro) : entrevista.roteiro
    if (Array.isArray(roteiroObj)) {
      parsedCategories = roteiroObj
    } else if (roteiroObj) {
      parsedCategories = roteiroObj.categories || []
      briefing = roteiroObj.briefing || ''
      redFlags = roteiroObj.red_flags || []
    }
  } catch {
    /* intentionally ignored */
  }

  let relatorio: any = {}
  try {
    relatorio = JSON.parse(entrevista.resumo || '{}')
  } catch {
    /* intentionally ignored */
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <PageHeader title="Sala de Entrevista" subtitle={`${candidato?.nome} • ${vaga?.titulo}`}>
        <Badge className="bg-indigo-100 text-indigo-700">
          {entrevista.status.replace('_', ' ').toUpperCase()}
        </Badge>
      </PageHeader>

      {entrevista.realizada_em && (
        <div className="flex flex-col gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
              <span className="font-semibold text-emerald-800">Entrevista Realizada</span>
              <span className="text-emerald-700">
                {' '}
                em{' '}
                {new Date(entrevista.realizada_em).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                por <span className="font-medium">{realizadaPor?.nome || 'Usuário'}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-8">
            <Badge
              variant="outline"
              className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> Agenda concluída
            </Badge>
            <Badge
              variant="outline"
              className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs"
            >
              Kanban: Entrevistado
            </Badge>
          </div>
        </div>
      )}

      {entrevista.status === 'aguardando' && (
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <Bot className="w-12 h-12 text-indigo-500 mx-auto" />
            <h2 className="text-xl font-semibold">Preparação da Entrevista</h2>
            <p className="text-slate-500 max-w-md mx-auto">
              O Copilot irá cruzar a descrição da vaga "{vaga?.titulo}" com o perfil do candidato
              para gerar o roteiro ideal.
            </p>
            <Button
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={gerarPrep}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <FileText className="w-5 h-5 mr-2" />
              )}
              Gerar Preparação com IA
            </Button>
          </CardContent>
        </Card>
      )}

      {entrevista.status === 'roteiro_pronto' && localStatus === 'idle' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <Card>
              <CardHeader className="bg-slate-50 border-b pb-4">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" /> Roteiro de Perguntas
                </CardTitle>
                {entrevista.roteiro && (
                  <RefinarBloco
                    shortcutChips={[
                      'Mais específico ao CV do candidato',
                      'Mais perguntas técnicas',
                      'Mais curto e direto',
                    ]}
                    onRefine={refinarRoteiro}
                  />
                )}
              </CardHeader>
              <CardContent className="p-6">
                {briefing && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-4">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                      Briefing
                    </span>
                    <p className="text-sm text-slate-700 mt-1">{briefing}</p>
                  </div>
                )}
                <Accordion type="multiple" className="w-full space-y-3">
                  {parsedCategories.map((cat: any, i: number) => (
                    <div key={i} className="space-y-2">
                      <h3 className="font-semibold text-slate-800 flex items-center gap-2 pb-1 border-b">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
                          {i + 1}
                        </span>
                        {cat.category || cat.name}
                      </h3>
                      {(cat.questions || []).map((q: any, j: number) => (
                        <AccordionItem
                          value={`c${i}-q${j}`}
                          key={j}
                          className="bg-white border rounded-lg px-4"
                        >
                          <AccordionTrigger className="hover:no-underline py-3 text-left font-medium text-slate-900 text-sm">
                            {q.text}
                          </AccordionTrigger>
                          <AccordionContent className="text-slate-600 space-y-2 pb-3 text-sm">
                            <div className="bg-slate-50 p-2 rounded">
                              <span className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Competência
                              </span>
                              <span className="text-sm font-medium text-slate-700">
                                {q.competency}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded">
                              <span className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Indicadores
                              </span>
                              <span className="text-sm text-slate-700">{q.indicators}</span>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </div>
                  ))}
                </Accordion>
                {redFlags.length > 0 && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Sinais de Alerta
                    </span>
                    <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-amber-800">
                      {redFlags.map((flag, i) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Candidato</span>
                  <span className="font-medium">{candidato?.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vaga</span>
                  <span className="font-medium">{vaga?.titulo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Empresa</span>
                  <span className="font-medium">{vaga?.empresa || 'N/A'}</span>
                </div>
                {agendamento && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Agendado</span>
                    <span className="font-medium">
                      {new Date(agendamento.agendada_para).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Transcrição Manual</CardTitle>
                <CardDescription className="text-xs">
                  Cole a transcrição da entrevista (mín. 100 caracteres).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Cole aqui a transcrição da entrevista..."
                  className="min-h-[180px] text-sm"
                />
                <div className="flex justify-between items-center">
                  <span
                    className={cn(
                      'text-xs',
                      transcript.length < 100 ? 'text-amber-600' : 'text-slate-500',
                    )}
                  >
                    {transcript.length} caracteres {transcript.length < 100 && '(mín. 100)'}
                  </span>
                  <Button variant="outline" size="sm" onClick={startCall}>
                    <Video className="w-4 h-4 mr-1.5" /> Videochamada
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12"
              onClick={confirmarEntrevista}
              disabled={transcript.length < 100 || analyzing}
            >
              {analyzing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Confirmar entrevista realizada e analisar
            </Button>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Anotações</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  onBlur={saveNotas}
                  placeholder="Faça anotações durante a entrevista..."
                  className="min-h-[80px] text-sm bg-yellow-50/50 border-yellow-200"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {localStatus === 'in_progress' && (
        <div className="fixed inset-0 bg-slate-950 z-[100] flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 border border-red-500/30">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Gravando
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <Button variant="destructive" size="lg" className="rounded-full px-8" onClick={endCall}>
              <PhoneOff className="w-5 h-5 mr-2" /> Finalizar Videochamada
            </Button>
          </div>
        </div>
      )}

      {entrevista.status === 'em_analise' && (
        <Card className="text-center py-16">
          <CardContent className="space-y-6">
            <Activity className="w-16 h-16 text-indigo-500 mx-auto animate-pulse" />
            <div>
              <h2 className="text-xl font-semibold mb-2">Processando Análise</h2>
              <p className="text-slate-500">
                A IA está analisando a transcrição para gerar o perfil DISC e o relatório...
              </p>
            </div>
            <Progress value={65} className="w-[60%] mx-auto" />
          </CardContent>
        </Card>
      )}

      {entrevista.status === 'concluida' && (
        <div className="space-y-6">
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h2 className="text-xl font-semibold">Entrevista Registrada</h2>
              <p className="text-slate-500 max-w-md mx-auto">
                A transcrição foi salva e o status do candidato foi atualizado para
                &quot;Entrevistado&quot;. A análise da IA pode ser executada novamente.
              </p>
              <Button
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={async () => {
                  setAnalyzing(true)
                  try {
                    await supabase.from('entrevistas').update({ status: 'em_analise' }).eq('id', id)
                    setEntrevista({ ...entrevista, status: 'em_analise' })
                    const { data: aiData, error: aiError } = await supabase.functions.invoke(
                      'copilot-analyze-interview',
                      {
                        body: { entrevista_id: id },
                      },
                    )
                    if (aiError || aiData?.error) {
                      await supabase
                        .from('entrevistas')
                        .update({ status: 'concluida' })
                        .eq('id', id)
                      setEntrevista({ ...entrevista, status: 'concluida' })
                      const inlineAiErrMsg = aiError?.message || aiData?.error || ''
                      if (
                        aiError instanceof TypeError ||
                        inlineAiErrMsg.includes('Failed to fetch') ||
                        inlineAiErrMsg.includes('Relay Error')
                      ) {
                        toast.error(
                          'Erro de conexão: Não foi possível alcançar o serviço de IA. Verifique sua internet ou tente novamente mais tarde.',
                        )
                      } else {
                        toast.error(
                          'Entrevista registrada. A análise da IA falhou e pode ser executada novamente.',
                        )
                      }
                    } else {
                      toast.success('Análise iniciada! Aguarde...')
                    }
                  } catch {
                    toast.error('Erro ao processar análise')
                  }
                  setAnalyzing(false)
                }}
                disabled={analyzing}
              >
                {analyzing ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Activity className="w-5 h-5 mr-2" />
                )}
                Executar Análise com IA
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" /> Transcrição
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px] w-full p-6">
                <div className="space-y-2 font-mono text-sm">
                  {entrevista.transcricao ? (
                    entrevista.transcricao.split('\n').map((line: string, i: number) => (
                      <div
                        key={i}
                        className={`p-2 rounded ${line.includes('[Headhunter]') ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-50 text-slate-800'}`}
                      >
                        {line}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-center py-8">
                      Nenhuma transcrição disponível.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {(entrevista.status === 'analisada' || entrevista.status === 'entregue') && (
        <div className="space-y-6">
          <Card className="border-indigo-100 shadow-md">
            <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 py-4">
              <div className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <CheckCircle2 className="w-6 h-6 text-indigo-600" /> Parecer Técnico Automático
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = `${window.location.origin}/candidato/entrevista/${id}`
                      navigator.clipboard.writeText(link)
                      toast.success('Link copiado!')
                    }}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Link
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadTranscript}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Transcrição
                  </Button>
                </div>
              </div>
              {entrevista.resumo &&
                (entrevista.status === 'concluida' || entrevista.status === 'entregue') && (
                  <RefinarBloco
                    shortcutChips={[
                      'Detalhar os riscos',
                      'Focar mais na aderência à vaga',
                      'Resumo mais executivo',
                    ]}
                    onRefine={refinarAnalise}
                  />
                )}
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-x-12 gap-y-8 mb-8">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4 border-b pb-2">
                    1. Perfil DISC
                  </h3>
                  <div className="mb-6">
                    <DiscBadge disc={entrevista.disc} className="h-10 text-sm px-4 rounded-full" />
                  </div>
                  <div className="space-y-4">
                    {[
                      { l: 'D', c: 'bg-[#E63946]' },
                      { l: 'I', c: 'bg-[#F77F00]' },
                      { l: 'S', c: 'bg-[#06A77D]' },
                      { l: 'C', c: 'bg-[#457B9D]' },
                    ].map((item) => {
                      const val = entrevista.disc?.[item.l] || 0
                      return (
                        <div key={item.l} className="flex items-center gap-3">
                          <span className="w-4 font-bold text-slate-700">{item.l}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${item.c}`} style={{ width: `${val}%` }} />
                          </div>
                          <span className="w-10 text-right text-sm font-medium text-slate-600">
                            {val}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3 border-b pb-2">
                      2. Resumo Executivo
                    </h3>
                    <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                      {relatorio.executive_summary || relatorio.alignment}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-600 mb-3 border-b border-emerald-100 pb-2">
                      3. Pontos Fortes
                    </h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                      {(relatorio.strengths || []).map((s: string) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-600 mb-3 border-b border-amber-100 pb-2">
                      4. Pontos de Atenção
                    </h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                      {(relatorio.risks || []).map((s: string) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-x-12 gap-y-6 border-t border-slate-100 pt-6 bg-slate-50/50 -mx-6 -mb-6 p-6 rounded-b-lg">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    5. Recomendação
                  </h3>
                  <Badge
                    variant="outline"
                    className="text-base px-4 py-1.5 bg-white shadow-sm border-slate-200 text-slate-800"
                  >
                    {relatorio.recommendation}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    6. Próximos Passos
                  </h3>
                  <p className="text-sm text-slate-700">{relatorio.nextSteps}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <CandidateAnalyticSummary
            dadosAdicionais={candidato?.dados_adicionais}
            resumoEntrevista={entrevista.resumo}
          />

          <Card className="border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" /> Transcrição Completa
              </CardTitle>
              {entrevista.realizada_em && (
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {new Date(entrevista.realizada_em).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Badge>
                  {realizadaPor?.nome && (
                    <span className="text-slate-600">
                      Registrado por <span className="font-medium">{realizadaPor.nome}</span>
                    </span>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px] w-full p-6">
                <div className="space-y-2 font-mono text-sm">
                  {entrevista.transcricao ? (
                    entrevista.transcricao.split('\n').map((line: string, i: number) => (
                      <div
                        key={i}
                        className={`p-2 rounded ${line.includes('[Headhunter]') ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-50 text-slate-800'}`}
                      >
                        {line}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-center py-8">
                      Nenhuma transcrição disponível.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {entrevista.status === 'analisada' && (
            <Card className="border-emerald-100">
              <CardHeader className="bg-emerald-50/30">
                <CardTitle className="text-lg">Sincronizar com CRM</CardTitle>
                <CardDescription>Qual é a sua decisão final sobre o candidato?</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4 pt-6">
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleFinalize('Aprovado')}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5 mr-2" />
                  )}{' '}
                  Aprovar
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-amber-500 text-amber-700 hover:bg-amber-50"
                  onClick={() => handleFinalize('Em Análise')}
                  disabled={analyzing}
                >
                  <Clock className="w-5 h-5 mr-2" /> Manter em Análise
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handleFinalize('Reprovado')}
                  disabled={analyzing}
                >
                  <X className="w-5 h-5 mr-2" /> Reprovar
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
