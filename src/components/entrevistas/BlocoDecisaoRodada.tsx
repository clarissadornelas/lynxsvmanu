import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertTriangle, ArrowRight, ListPlus, X, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { DiscBadge } from '@/components/DiscBadge'
import SaidaProcessoModal from '@/components/kanban/SaidaProcessoModal'
import { avancarRodada, mandarParaShortlist, naoPassar } from '@/lib/avanco'
import type { MotivoSaida } from '@/lib/funnel-phases'

type Phase = 'analisando' | 'pronta' | 'falhou' | 'sem_parecer'

interface Parecer {
  executive_summary: string
  strengths: string[]
  risks: string[]
}

interface BlocoDecisaoRodadaProps {
  entrevistaId: string
  candidatoId: string
  candidatoNome: string
  candidatoStatus: string
  vagaId: string
  tenantId: string
  rodadaAtual: number
  totalRodadas: number
  proximaRodada: { n: number; nome: string } | null
  onDecidido: () => void
}

const MENSAGENS = [
  'Avaliacao salva. Preparando a analise da rodada...',
  'Lendo a transcricao da entrevista...',
  'Montando o parecer e o perfil comportamental...',
]

export default function BlocoDecisaoRodada({
  entrevistaId,
  candidatoId,
  candidatoNome,
  candidatoStatus,
  vagaId,
  tenantId,
  rodadaAtual,
  totalRodadas,
  proximaRodada,
  onDecidido,
}: BlocoDecisaoRodadaProps) {
  const [phase, setPhase] = useState<Phase>('analisando')
  const [progress, setProgress] = useState(4)
  const [msgIndex, setMsgIndex] = useState(0)
  const [podePular, setPodePular] = useState(false)
  const [parecer, setParecer] = useState<Parecer | null>(null)
  const [disc, setDisc] = useState<any>(null)
  const [erroTecnico, setErroTecnico] = useState<string | null>(null)
  const [decidindo, setDecidindo] = useState(false)
  const [decisaoAtiva, setDecisaoAtiva] = useState<'avancar' | 'shortlist' | null>(null)
  const [saidaModalAberta, setSaidaModalAberta] = useState(false)
  const [semParecerFlag, setSemParecerFlag] = useState(false)

  const iniciouRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const startTimeRef = useRef(Date.now())
  const skipRef = useRef(false)
  const mountedRef = useRef(true)

  const semParecer = semParecerFlag

  const executarAnalise = useCallback(async () => {
    await supabase.from('entrevistas').update({ status: 'em_analise' }).eq('id', entrevistaId)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      await supabase.from('entrevistas').update({ status: 'concluida' }).eq('id', entrevistaId)
      setErroTecnico('Sessao nao encontrada')
      setSemParecerFlag(true)
      setPhase('falhou')
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-analyze-interview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ entrevista_id: entrevistaId }),
          signal: controller.signal,
        },
      )
      clearTimeout(timeoutId)
      if (!resp.ok)
        throw new Error((await resp.json().catch(() => ({}))).error || `HTTP ${resp.status}`)
      const { data: ent } = await supabase
        .from('entrevistas')
        .select('resumo, disc')
        .eq('id', entrevistaId)
        .maybeSingle()
      if (skipRef.current || !mountedRef.current) return
      setDisc(ent?.disc ?? null)
      let parsed: Parecer | null = null
      if (ent?.resumo) {
        try {
          const raw = typeof ent.resumo === 'string' ? JSON.parse(ent.resumo) : ent.resumo
          if (raw?.executive_summary || raw?.strengths || raw?.risks) {
            parsed = {
              executive_summary: String(raw.executive_summary || ''),
              strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String) : [],
              risks: Array.isArray(raw.risks) ? raw.risks.map(String) : [],
            }
          }
        } catch {
          /* parsing failed */
        }
      }
      if (parsed) {
        setParecer(parsed)
        setSemParecerFlag(false)
        setPhase('pronta')
      } else {
        setSemParecerFlag(true)
        setPhase('pronta')
      }
      setProgress(100)
    } catch (err) {
      clearTimeout(timeoutId)
      if (!mountedRef.current) return
      await supabase.from('entrevistas').update({ status: 'concluida' }).eq('id', entrevistaId)
      if (skipRef.current) return
      setSemParecerFlag(true)
      setErroTecnico(err instanceof Error ? err.message : String(err))
      setPhase('falhou')
      setProgress(100)
    }
  }, [entrevistaId])

  useEffect(() => {
    if (iniciouRef.current) return
    iniciouRef.current = true
    executarAnalise()
  }, [executarAnalise])

  useEffect(() => {
    if (phase !== 'analisando') return
    const pi = setInterval(
      () => setProgress(Math.min(92, 4 + Math.floor((Date.now() - startTimeRef.current) / 330))),
      200,
    )
    const mi = setInterval(() => setMsgIndex((p) => (p + 1) % MENSAGENS.length), 4000)
    const pt = setTimeout(() => setPodePular(true), 12000)
    return () => {
      clearInterval(pi)
      clearInterval(mi)
      clearTimeout(pt)
    }
  }, [phase])

  useEffect(
    () => () => {
      mountedRef.current = false
      abortRef.current?.abort()
    },
    [],
  )

  const handlePular = () => {
    skipRef.current = true
    setSemParecerFlag(true)
    setPhase('sem_parecer')
    setProgress(100)
  }

  const handleRetry = () => {
    if (decidindo) return
    abortRef.current?.abort()
    skipRef.current = false
    setSemParecerFlag(false)
    setErroTecnico(null)
    setParecer(null)
    setDisc(null)
    setPodePular(false)
    setMsgIndex(0)
    setProgress(4)
    startTimeRef.current = Date.now()
    setPhase('analisando')
    executarAnalise()
  }

  const handleAvancar = async () => {
    if (decidindo || !proximaRodada) return
    setDecidindo(true)
    setDecisaoAtiva('avancar')
    try {
      const r = await avancarRodada({
        candidatoId,
        vagaId,
        tenantId,
        entrevistaId,
        rodadaAtual,
        proximaRodada: proximaRodada.n,
        semParecer,
        ator: 'avaliacao',
      })
      if (r.success) {
        if (r.erro) {
          toast.warning(`${candidatoNome} avancou, mas o sinal para o agente falhou: ${r.erro}`)
        } else {
          toast.success(
            `${candidatoNome} avancou para ${proximaRodada.nome}. O agente foi sinalizado para agendar.`,
          )
        }
        onDecidido()
      } else {
        toast.error(r.erro || 'Erro ao avancar.')
      }
    } finally {
      setDecidindo(false)
      setDecisaoAtiva(null)
    }
  }

  const handleShortlist = async () => {
    if (decidindo) return
    setDecidindo(true)
    setDecisaoAtiva('shortlist')
    try {
      const r = await mandarParaShortlist({
        candidatoId,
        vagaId,
        tenantId,
        entrevistaId,
        statusAtual: candidatoStatus,
        semParecer,
        ator: 'avaliacao',
      })
      if (r.success) {
        toast.success(
          `${candidatoNome} entrou na shortlist como no ${r.ordem}. Ajuste a ordem na aba Decisao.`,
        )
        onDecidido()
      } else {
        toast.error(r.erro || 'Erro ao adicionar a shortlist.')
      }
    } finally {
      setDecidindo(false)
      setDecisaoAtiva(null)
    }
  }

  const handleConfirmarSaida = async (motivo: MotivoSaida) => {
    if (decidindo) return
    setDecidindo(true)
    try {
      const r = await naoPassar({
        candidatoId,
        vagaId,
        tenantId,
        entrevistaId,
        statusAtual: candidatoStatus,
        motivo,
        semParecer,
        ator: 'avaliacao',
      })
      if (r.success) {
        if (r.baseAtivaError) {
          toast.warning(`${candidatoNome} saiu do processo, mas nao entrou na Base Ativa.`)
        } else {
          toast.success(`${candidatoNome} saiu do processo e foi para a Base Ativa.`)
        }
        setSaidaModalAberta(false)
        onDecidido()
      } else {
        toast.error('Não foi possível registrar a saída.')
      }
    } finally {
      setDecidindo(false)
    }
  }

  return (
    <div className="space-y-4">
      {phase === 'analisando' && (
        <div className="space-y-4 rounded-lg border border-slate-200 p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-slate-600">{MENSAGENS[msgIndex]}</p>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden max-w-md mx-auto">
            <div
              className="h-full bg-primary rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          {podePular && (
            <Button variant="ghost" size="sm" onClick={handlePular} className="text-slate-500">
              Decidir sem esperar o parecer
            </Button>
          )}
        </div>
      )}

      {phase === 'falhou' && (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-900">
                O parecer da IA nao foi gerado. A decisao continua liberada e ficara registrada como
                decidida sem parecer.
              </p>
              {erroTecnico && (
                <p className="text-xs text-amber-700">Detalhe tecnico: {erroTecnico}</p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRetry} disabled={decidindo}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar gerar de novo
          </Button>
        </div>
      )}

      {phase === 'sem_parecer' && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm text-indigo-800">
            Decidindo sem esperar o parecer da IA. A analise continua rodando em segundo plano.
          </p>
        </div>
      )}

      {phase === 'pronta' && parecer && (
        <div className="space-y-4 rounded-lg border border-slate-200 p-4">
          {disc && (
            <div className="flex items-center gap-2">
              <DiscBadge disc={disc} />
              <Badge variant="outline" className="text-xs text-slate-500">
                nao entra na decisao
              </Badge>
            </div>
          )}
          <p className="text-sm text-slate-700">{parecer.executive_summary}</p>
          {parecer.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-emerald-700 mb-1">Pontos fortes</p>
              <ul className="space-y-1">
                {parecer.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parecer.risks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-700 mb-1">Pontos de atencao</p>
              <ul className="space-y-1">
                {parecer.risks.map((r, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start gap-1.5">
                    <span className="text-amber-600 font-bold">!</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {phase !== 'analisando' && (
        <div className="space-y-3">
          {semParecer && (
            <p className="text-xs text-slate-500 italic">
              Esta decisao sera registrada como tomada sem o parecer da IA.
            </p>
          )}
          <p className="text-sm font-medium text-slate-900">
            Qual o proximo passo de {candidatoNome}?
          </p>
          {!proximaRodada && (
            <p className="text-xs text-slate-500">
              Esta e a ultima rodada da vaga (rodada {rodadaAtual} de {totalRodadas}). Nao ha
              proxima etapa para avancar.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {proximaRodada && (
              <Button onClick={handleAvancar} disabled={decidindo} className="justify-start">
                {decisaoAtiva === 'avancar' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Avancar para {proximaRodada.nome}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={handleShortlist}
              disabled={decidindo}
              className="justify-start"
            >
              {decisaoAtiva === 'shortlist' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ListPlus className="w-4 h-4 mr-2" />
              )}
              Mandar para a shortlist
            </Button>
            <Button
              variant="outline"
              onClick={() => setSaidaModalAberta(true)}
              disabled={decidindo}
              className="justify-start"
            >
              <X className="w-4 h-4 mr-2" /> Nao passar
            </Button>
          </div>
        </div>
      )}

      <SaidaProcessoModal
        open={saidaModalAberta}
        onOpenChange={setSaidaModalAberta}
        nomeCandidato={candidatoNome}
        permiteRecusouProposta={false}
        onConfirmar={handleConfirmarSaida}
      />
    </div>
  )
}
