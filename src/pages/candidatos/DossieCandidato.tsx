import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Loader2, ChevronLeft, FileText, Bot, Video, ClipboardCheck } from 'lucide-react'
import { getInitials } from '@/lib/avatar-utils'
import {
  parseEtapas,
  parseAvaliacao,
  notaECobertura,
  rotuloTipoRodada,
  rotuloNota,
  type AvaliacaoEntrevista,
  type ResultadoCobertura,
} from '@/lib/funnel-phases'
import { parseDiscDaRodada, consolidarDisc } from '@/lib/disc'

interface RoundData {
  ent: any
  rodadaNum: number
  etapaName: string
  etapaTipo: string
  avaliacao: AvaliacaoEntrevista | null
  cobertura: ResultadoCobertura
  coverageRatio: number
  status: 'avaliada' | 'parcial' | 'sem'
  executiveSummary: string | null
  discData: any | null
  decisao: string | null
}

const ROTULO_DECISAO: Record<string, string> = {
  avancou: 'avançou de rodada',
  shortlist: 'foi para a shortlist',
  nao_passou: 'não passou',
  encerrada: 'encerrada sem avançar',
}

export default function DossieCandidato() {
  const { candidatoId } = useParams<{ candidatoId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [candidate, setCandidate] = useState<any>(null)
  const [vaga, setVaga] = useState<any>(null)
  const [entrevistas, setEntrevistas] = useState<any[]>([])
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const fetchData = async () => {
      if (!candidatoId) {
        setLoading(false)
        return
      }
      setLoading(true)
      const { data: cand } = await supabase
        .from('candidatos')
        .select('*')
        .eq('id', candidatoId)
        .maybeSingle()
      if (!cand) {
        setLoading(false)
        return
      }
      setCandidate(cand)
      if (cand.vaga_id) {
        const { data: v } = await supabase
          .from('vagas')
          .select('titulo, etapas')
          .eq('id', cand.vaga_id)
          .maybeSingle()
        setVaga(v)
      }
      const { data: ents } = await supabase
        .from('entrevistas')
        .select('*')
        .eq('candidato_id', candidatoId)
        .order('rodada', { ascending: true })
      setEntrevistas(ents || [])
      setLoading(false)
    }
    fetchData()
  }, [candidatoId])

  const etapas = useMemo(() => parseEtapas(vaga?.etapas), [vaga])

  const roundsData: RoundData[] = useMemo(() => {
    return entrevistas.map((ent) => {
      const etapa = etapas.find((e) => e.n === ent.rodada) || null
      const rodadaNum = ent.rodada || 1
      const etapaName = etapa?.nome || `Rodada ${rodadaNum}`
      const etapaTipo = rotuloTipoRodada(etapa?.tipo || 'rh')
      const avaliacao = parseAvaliacao(ent.avaliacao)
      const cobertura = notaECobertura(avaliacao)
      const coverageRatio = cobertura.fechadas > 0 ? cobertura.respondidas / cobertura.fechadas : 1
      let status: RoundData['status'] = 'sem'
      if (ent.avaliada_em) {
        status = coverageRatio >= 0.6 ? 'avaliada' : 'parcial'
      }
      let executiveSummary: string | null = null
      if (ent.resumo) {
        try {
          const parsed = JSON.parse(ent.resumo)
          executiveSummary = parsed?.executive_summary || null
        } catch {
          executiveSummary = null
        }
      }
      let discData: any = null
      if (ent.disc) {
        let disc: any = ent.disc
        if (typeof disc === 'string') {
          try {
            disc = JSON.parse(disc)
          } catch {
            disc = null
          }
        }
        if (disc && (disc.profile || disc.perfil)) {
          discData = disc
        }
      }
      return {
        ent,
        rodadaNum,
        etapaName,
        etapaTipo,
        avaliacao,
        cobertura,
        coverageRatio,
        status,
        executiveSummary,
        discData,
        decisao: typeof ent.decisao === 'string' ? ent.decisao : null,
      }
    })
  }, [entrevistas, etapas])

  const avaliadoRounds = roundsData.filter((r) => r.ent.avaliada_em)
  const scoredRounds = avaliadoRounds.filter((r) => r.cobertura.media !== null)
  const notaGeral =
    scoredRounds.length > 0
      ? scoredRounds.reduce((acc, r) => acc + (r.cobertura.media ?? 0), 0) / scoredRounds.length
      : null
  const totalRespondidas = avaliadoRounds.reduce((acc, r) => acc + r.cobertura.respondidas, 0)
  const totalFechadas = avaliadoRounds.reduce((acc, r) => acc + r.cobertura.fechadas, 0)
  const lastRound = roundsData[roundsData.length - 1] || null
  const lastExecutiveSummary = lastRound?.executiveSummary || null

  const discConsolidado = useMemo(() => {
    const rodadas = roundsData
      .map((rd) => {
        let rawDisc: unknown = rd.ent.disc
        if (typeof rawDisc === 'string') {
          try {
            rawDisc = JSON.parse(rawDisc)
          } catch {
            rawDisc = null
          }
        }
        if (!rawDisc) return null
        return parseDiscDaRodada(rawDisc, rd.rodadaNum, rd.etapaName)
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    return consolidarDisc(rodadas)
  }, [roundsData])

  const {
    divergencias: discDivergencias,
    rodadas: discRodadasCount,
    selo: discSelo,
  } = discConsolidado ?? { divergencias: [], rodadas: 0, selo: '' }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-slate-500 text-lg">Candidato não encontrado.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>
    )
  }

  const evaluatedCount = avaliadoRounds.length
  const evaluatedLabel =
    evaluatedCount === 0
      ? 'Nenhuma rodada avaliada'
      : evaluatedCount === 1
        ? '1 rodada avaliada'
        : `${evaluatedCount} rodadas avaliadas`

  const toggleTranscript = (id: string) =>
    setExpandedTranscripts((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-fade-in-up">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0 mt-1">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Avatar className="w-16 h-16 border-2 border-slate-100 shrink-0">
            <AvatarImage src={candidate.foto_url || undefined} />
            <AvatarFallback className="bg-slate-100 text-xl font-bold text-slate-600">
              {getInitials(candidate.nome)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900 truncate">{candidate.nome || '—'}</h1>
            <p className="text-sm text-slate-500">{candidate.cargo || 'Sem cargo informado'}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {typeof candidate.shortlist_ordem === 'number' && candidate.shortlist_ordem >= 1 && (
                <Badge
                  variant="outline"
                  className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
                >
                  Finalista nº {candidate.shortlist_ordem}
                </Badge>
              )}
              <span className="text-xs text-slate-500">{evaluatedLabel}</span>
            </div>
          </div>
        </div>
        {candidate.cv_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={candidate.cv_url} target="_blank" rel="noopener noreferrer">
              <FileText className="w-4 h-4 mr-1" />
              Abrir CV
            </a>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Nota geral</p>
              <p className="text-2xl font-bold text-slate-900">
                {notaGeral !== null
                  ? notaGeral.toLocaleString('pt-BR', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 1,
                    })
                  : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Cobertura</p>
              <p className="text-sm font-medium text-slate-700">
                {totalRespondidas} de {totalFechadas}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {roundsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rodadas</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {roundsData.map((rd, idx) => (
                <AccordionItem key={rd.ent.id} value={`rodada-${idx}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 flex-1 pr-4">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-medium">
                        {rd.rodadaNum}
                      </span>
                      <span className="text-sm font-medium text-slate-900 flex-1 text-left truncate">
                        {rd.etapaName}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {rd.etapaTipo}
                      </Badge>
                      {rd.status === 'avaliada' && (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 shrink-0">
                          avaliada
                        </Badge>
                      )}
                      {rd.status === 'parcial' && (
                        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 shrink-0">
                          cobertura parcial
                        </Badge>
                      )}
                      {rd.status === 'sem' && (
                        <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 shrink-0">
                          sem avaliação
                        </Badge>
                      )}
                      {rd.cobertura.media !== null && (
                        <span className="text-sm font-medium text-slate-700 shrink-0">
                          {rd.cobertura.media.toLocaleString('pt-BR', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 1,
                          })}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 shrink-0">
                        {rd.cobertura.respondidas}/{rd.cobertura.fechadas}
                      </span>
                      {rd.decisao && (
                        <Badge variant="outline" className="text-xs shrink-0 bg-slate-50">
                          {ROTULO_DECISAO[rd.decisao] ?? rd.decisao}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/entrevistas/${rd.ent.id}`}>
                          <Video className="w-4 h-4 mr-1" />
                          Abrir a sala desta rodada
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/avaliar/${rd.ent.id}`}>
                          <ClipboardCheck className="w-4 h-4 mr-1" />
                          {rd.ent.avaliada_em ? 'Rever a análise' : 'Analisar e decidir rodada'}
                        </Link>
                      </Button>
                      {!rd.decisao && rd.ent.avaliada_em && (
                        <span className="text-xs text-orange-600 font-medium">
                          decisão pendente
                        </span>
                      )}
                    </div>
                    {rd.avaliacao && rd.avaliacao.respostas.length > 0 ? (
                      <div className="space-y-3">
                        {rd.avaliacao.respostas.map((resp, rIdx) => (
                          <div key={rIdx} className="border-l-2 border-slate-100 pl-3 py-1">
                            <p className="text-sm font-medium text-slate-900">{resp.texto}</p>
                            <p className="text-sm text-slate-500 mt-0.5">
                              {resp.tipo === 'fechada'
                                ? resp.nota !== null
                                  ? rotuloNota(resp.nota)
                                  : 'sem registro'
                                : resp.resposta_texto || 'sem registro'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Nenhuma pergunta registrada.</p>
                    )}
                    {rd.avaliacao?.observacoes && (
                      <div className="bg-slate-50 p-3 rounded-lg">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                          Observações
                        </p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {rd.avaliacao.observacoes}
                        </p>
                      </div>
                    )}
                    {rd.ent.transcricao && (
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTranscript(rd.ent.id)}
                        >
                          {expandedTranscripts[rd.ent.id]
                            ? 'Ocultar transcrição'
                            : 'Ver transcrição'}
                        </Button>
                        {expandedTranscripts[rd.ent.id] && (
                          <div className="mt-2 bg-slate-50 rounded-lg p-3 max-h-64 overflow-y-auto">
                            <p className="text-sm text-slate-600 whitespace-pre-wrap">
                              {rd.ent.transcricao}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {lastExecutiveSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              Parecer da IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {lastExecutiveSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {discConsolidado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Leitura de estilo · DISC
              <span className="text-xs font-normal text-slate-400">(não entra na decisão)</span>
              <Badge
                variant="outline"
                className="ml-auto text-xs bg-indigo-50 text-indigo-700 border-indigo-200"
              >
                {discSelo}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-indigo-700">{discConsolidado.perfil}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">D:</span>
                  <span className="font-medium text-slate-700 tabular-nums">
                    {discConsolidado.D}%
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">I:</span>
                  <span className="font-medium text-slate-700 tabular-nums">
                    {discConsolidado.I}%
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">S:</span>
                  <span className="font-medium text-slate-700 tabular-nums">
                    {discConsolidado.S}%
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">C:</span>
                  <span className="font-medium text-slate-700 tabular-nums">
                    {discConsolidado.C}%
                  </span>
                </div>
              </div>
            </div>
            {discDivergencias.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-amber-800">
                  O estilo variou entre as rodadas
                </p>
                {discDivergencias.map((div, idx) => (
                  <p key={idx} className="text-sm text-amber-700">
                    {div.frase}
                  </p>
                ))}
              </div>
            )}
            {discRodadasCount > 1 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Por rodada</p>
                {roundsData.map((rd) => {
                  let rawDisc: unknown = rd.ent.disc
                  if (typeof rawDisc === 'string') {
                    try {
                      rawDisc = JSON.parse(rawDisc)
                    } catch {
                      rawDisc = null
                    }
                  }
                  if (!rawDisc) return null
                  const parsed = parseDiscDaRodada(rawDisc, rd.rodadaNum, rd.etapaName)
                  if (!parsed) return null
                  return (
                    <div key={rd.ent.id} className="flex items-center gap-2 text-sm py-1 flex-wrap">
                      <span className="text-slate-600 flex-1 min-w-0 truncate">{rd.etapaName}</span>
                      <span className="font-medium text-slate-700 w-10 text-center">
                        {parsed.perfil || '—'}
                      </span>
                      <span className="text-slate-500 tabular-nums w-14 text-right">
                        D: {parsed.D !== null ? `${parsed.D}%` : '—'}
                      </span>
                      <span className="text-slate-500 tabular-nums w-14 text-right">
                        I: {parsed.I !== null ? `${parsed.I}%` : '—'}
                      </span>
                      <span className="text-slate-500 tabular-nums w-14 text-right">
                        S: {parsed.S !== null ? `${parsed.S}%` : '—'}
                      </span>
                      <span className="text-slate-500 tabular-nums w-14 text-right">
                        C: {parsed.C !== null ? `${parsed.C}%` : '—'}
                      </span>
                      {parsed.confianca !== null && (
                        <span className="text-slate-400 text-xs whitespace-nowrap">
                          confiança: {parsed.confianca}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
