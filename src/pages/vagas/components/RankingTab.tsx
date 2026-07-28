import { useState, useEffect, useMemo } from 'react'
import type { Candidate } from '@/stores/useRecruitmentStore'
import useRecruitmentStore from '@/stores/useRecruitmentStore'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Search,
  ChevronRight,
  User,
  UserCheck,
  Loader2,
  Trophy,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/avatar-utils'

interface InterviewData {
  id: string
  resumo: string | null
  disc: any
  status: string
  candidato_id: string
}

function parseJson<T>(raw: any): T {
  if (!raw) return {} as T
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch {
      return {} as T
    }
  }
  return raw as T
}

function getCvScore(c: Candidate): number {
  if (typeof c.score === 'number') return c.score
  return c.score?.total ?? 0
}

function DimCell({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div className="flex flex-col items-center px-2 py-1 rounded bg-slate-50 border border-slate-100 min-w-[55px]">
      <span className="text-[10px] text-slate-400 uppercase">{label}</span>
      <span className="text-sm font-semibold text-slate-700">
        {value == null ? '—' : typeof value === 'number' ? `${Math.round(value)}` : value}
      </span>
    </div>
  )
}

export default function RankingTab({
  candidates,
  jobId,
}: {
  candidates: Candidate[]
  jobId?: string
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [interviews, setInterviews] = useState<InterviewData[]>([])
  const [loading, setLoading] = useState(true)
  const [nonAnalyzedOpen, setNonAnalyzedOpen] = useState(false)
  const { reload, jobs } = useRecruitmentStore()

  const [hireStep, setHireStep] = useState<0 | 1 | 2>(0)
  const [hireCand, setHireCand] = useState<Candidate | null>(null)
  const [hireLoading, setHireLoading] = useState(false)
  const [closeJob, setCloseJob] = useState(true)
  const [rejectOthers, setRejectOthers] = useState(false)

  const job = jobs.find((j) => j.id === jobId)
  const jobTitle = job?.title || 'esta vaga'

  useEffect(() => {
    async function fetchInterviews() {
      if (!jobId) {
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('entrevistas')
        .select('id, resumo, disc, status, candidato_id')
        .in('status', ['analisada', 'entregue'])
      if (error) toast.error('Erro ao carregar entrevistas: ' + error.message)
      setInterviews(data || [])
      setLoading(false)
    }
    fetchInterviews()
  }, [jobId])

  const ivMap = useMemo(() => {
    const m = new Map<string, InterviewData>()
    interviews.forEach((iv) => m.set(iv.candidato_id, iv))
    return m
  }, [interviews])

  const { analyzed, nonAnalyzed } = useMemo(() => {
    const a: Candidate[] = []
    const n: Candidate[] = []
    candidates.forEach((c) => (ivMap.get(c.id) ? a : n).push(c))
    return { analyzed: a, nonAnalyzed: n }
  }, [candidates, ivMap])

  const sortedAnalyzed = useMemo(() => {
    return [...analyzed]
      .sort((a, b) => {
        const ar = parseJson<any>(ivMap.get(a.id)?.resumo).recommendation
        const br = parseJson<any>(ivMap.get(b.id)?.resumo).recommendation
        if (ar && !br) return -1
        if (!ar && br) return 1
        return getCvScore(b) - getCvScore(a)
      })
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.skills?.some((s: string) => s?.toLowerCase().includes(search.toLowerCase())),
      )
  }, [analyzed, ivMap, search])

  const sortedNonAnalyzed = useMemo(() => {
    return [...nonAnalyzed]
      .sort((a, b) => getCvScore(b) - getCvScore(a))
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.skills?.some((s: string) => s?.toLowerCase().includes(search.toLowerCase())),
      )
  }, [nonAnalyzed, search])

  const getRecBadge = (candId: string) => {
    const report = parseJson<any>(ivMap.get(candId)?.resumo)
    if (!report.recommendation) return null
    const r = String(report.recommendation).toLowerCase()
    if (r.includes('aprov'))
      return (
        <Badge className="bg-emerald-100 text-emerald-700 text-xs">IA recomenda: Aprovado</Badge>
      )
    if (r.includes('reprov'))
      return <Badge className="bg-red-100 text-red-700 text-xs">IA recomenda: Reprovado</Badge>
    if (r.includes('análise') || r.includes('analise'))
      return <Badge className="bg-amber-100 text-amber-700 text-xs">IA: Em Análise</Badge>
    return (
      <Badge className="bg-slate-100 text-slate-600 text-xs">IA: {report.recommendation}</Badge>
    )
  }

  const openHire = (c: Candidate) => {
    setHireCand(c)
    setHireStep(1)
    setCloseJob(true)
    setRejectOthers(false)
  }

  const confirmHire = async () => {
    if (!hireCand) return
    setHireLoading(true)
    const prev = hireCand.status
    const now = new Date().toISOString()
    const iv = ivMap.get(hireCand.id)

    const { error: e1 } = await supabase
      .from('candidatos')
      .update({ status: 'contratado', contratado_em: now, data_contratacao: now })
      .eq('id', hireCand.id)
    if (e1) {
      toast.error('Erro ao contratar: ' + e1.message)
      setHireLoading(false)
      return
    }

    const { error: e2 } = await supabase.from('candidato_eventos').insert({
      candidato_id: hireCand.id,
      vaga_id: hireCand.jobId || jobId || null,
      tenant_id: hireCand.tenantId || null,
      tipo: 'mudanca_fase',
      de: prev,
      para: 'contratado',
      agente: 'copiloto',
      ator: 'decisao_vaga',
      payload: { entrevista_id: iv?.id || null },
    })
    if (e2) {
      toast.error('Erro ao registrar evento: ' + e2.message)
      setHireLoading(false)
      return
    }

    setHireStep(2)
    setHireLoading(false)
  }

  const executePostHire = async () => {
    if (!hireCand) return
    setHireLoading(true)
    let closed = false
    let rejected = 0

    if (closeJob && jobId) {
      const { error: e } = await supabase
        .from('vagas')
        .update({ status: 'fechada' })
        .eq('id', jobId)
      if (e) {
        toast.error('Erro ao fechar vaga: ' + e.message)
        setHireLoading(false)
        return
      }
      closed = true
    }

    if (rejectOthers) {
      const others = sortedAnalyzed.filter((c) => c.id !== hireCand.id && c.status !== 'contratado')
      for (const c of others) {
        const prev = c.status
        const { error: e1 } = await supabase
          .from('candidatos')
          .update({ status: 'reprovado' })
          .eq('id', c.id)
        if (e1) {
          toast.error(`Erro ao reprovar ${c.name}: ${e1.message}`)
          setHireLoading(false)
          return
        }
        const { error: e2 } = await supabase.from('candidato_eventos').insert({
          candidato_id: c.id,
          vaga_id: c.jobId || jobId || null,
          tenant_id: c.tenantId || null,
          tipo: 'mudanca_fase',
          de: prev,
          para: 'reprovado',
          agente: 'copiloto',
          ator: 'decisao_vaga',
          payload: {},
        })
        if (e2) {
          toast.error(`Erro ao registrar evento: ${e2.message}`)
          setHireLoading(false)
          return
        }
        rejected++
      }
    }

    let msg = `${hireCand.name} contratada.`
    if (closed) msg += ' Vaga fechada.'
    if (rejected > 0)
      msg += ` ${rejected} candidato${rejected > 1 ? 's' : ''} reprovado${rejected > 1 ? 's' : ''}.`
    toast.success(msg)

    setHireStep(0)
    setHireCand(null)
    setSelected(null)
    setHireLoading(false)
    await reload()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="flex gap-6 h-full pb-8">
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nome ou skill..."
              className="pl-9 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            <Trophy className="w-3 h-3 mr-1" />
            {analyzed.length} analisados
          </Badge>
        </div>

        <div className="grid gap-3">
          {sortedAnalyzed.map((c, i) => {
            const iv = ivMap.get(c.id)
            const disc = parseJson<any>(iv?.disc)
            const cvScore = getCvScore(c)
            return (
              <Card
                key={c.id}
                className={cn(
                  'cursor-pointer hover:border-indigo-300 transition-colors bg-white shadow-sm',
                  c.status === 'contratado' && 'border-emerald-200 bg-emerald-50/30',
                )}
                onClick={() => setSelected(c)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold text-sm shrink-0">
                      #{i + 1}
                    </div>
                    <Avatar className="w-12 h-12 shrink-0">
                      <AvatarImage src={c.avatarUrl || undefined} alt={c.name} />
                      <AvatarFallback>{getInitials(c.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-slate-900 truncate">{c.name}</h3>
                          <p className="text-sm text-slate-500 truncate">{c.role}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {c.status === 'contratado' && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Contratado
                            </Badge>
                          )}
                          {getRecBadge(c.id)}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2 flex-wrap">
                        <DimCell label="Aderência CV" value={cvScore ? `${cvScore}%` : null} />
                        <DimCell label="D" value={disc.D} />
                        <DimCell label="I" value={disc.I} />
                        <DimCell label="S" value={disc.S} />
                        <DimCell label="C" value={disc.C} />
                      </div>
                    </div>
                    <div className="shrink-0">
                      {c.status === 'contratado' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Contratado
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={(e) => {
                            e.stopPropagation()
                            openHire(c)
                          }}
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1" /> Contratar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {sortedAnalyzed.length === 0 && (
            <div className="text-center py-8 text-slate-500">Nenhum candidato analisado ainda.</div>
          )}
        </div>

        <p className="text-xs text-slate-400 italic text-center py-2">
          Sem nota composta: as dimensões ficam abertas e a decisão é do operador.
        </p>

        {sortedNonAnalyzed.length > 0 && (
          <Card className="border-slate-200">
            <button
              className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              onClick={() => setNonAnalyzedOpen(!nonAnalyzedOpen)}
            >
              <span className="font-medium text-slate-700 text-sm">
                Sem entrevista analisada ({sortedNonAnalyzed.length})
              </span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-slate-400 transition-transform',
                  nonAnalyzedOpen && 'rotate-180',
                )}
              />
            </button>
            {nonAnalyzedOpen && (
              <CardContent className="p-0 border-t border-slate-100">
                <div className="divide-y divide-slate-100">
                  {sortedNonAnalyzed.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelected(c)}
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={c.avatarUrl || undefined} alt={c.name} />
                        <AvatarFallback className="text-xs">{getInitials(c.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-slate-700 text-sm flex-1 truncate">
                        {c.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getCvScore(c) ? `${getCvScore(c)}% CV` : 'N/A'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected &&
            (() => {
              const iv = ivMap.get(selected.id)
              const disc = parseJson<any>(iv?.disc)
              const report = parseJson<any>(iv?.resumo)
              return (
                <>
                  <SheetHeader className="text-left mb-6 pb-6 border-b border-slate-100">
                    <div className="flex items-center gap-4 mb-4">
                      <Avatar className="w-16 h-16 shadow-sm">
                        <AvatarImage src={selected.avatarUrl || undefined} alt={selected.name} />
                        <AvatarFallback className="text-lg">
                          {getInitials(selected.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <SheetTitle className="text-xl">{selected.name}</SheetTitle>
                        <SheetDescription>{selected.role}</SheetDescription>
                      </div>
                    </div>
                    <div className="flex gap-2 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" /> {selected.email}
                      </span>
                    </div>
                    {getRecBadge(selected.id) && (
                      <div className="mt-2">{getRecBadge(selected.id)}</div>
                    )}
                  </SheetHeader>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-900">Dimensões</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <DimCell
                          label="Aderência CV"
                          value={getCvScore(selected) ? `${getCvScore(selected)}%` : null}
                        />
                        <DimCell label="D" value={disc.D} />
                        <DimCell label="I" value={disc.I} />
                        <DimCell label="S" value={disc.S} />
                        <DimCell label="C" value={disc.C} />
                        <DimCell label="DISC" value={disc.profile} />
                      </div>
                    </div>
                    {report.executive_summary && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-900">Resumo Executivo</h4>
                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg">
                          {report.executive_summary}
                        </p>
                      </div>
                    )}
                    {report.strengths?.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-900">Pontos Fortes</h4>
                        <ul className="space-y-1">
                          {report.strengths.map((s: string, i: number) => (
                            <li
                              key={i}
                              className="text-sm text-slate-600 flex items-start gap-2 bg-emerald-50/50 p-2 rounded"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {report.risks?.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-900">Riscos</h4>
                        <ul className="space-y-1">
                          {report.risks.map((r: string, i: number) => (
                            <li
                              key={i}
                              className="text-sm text-slate-600 flex items-start gap-2 bg-red-50/50 p-2 rounded"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {report.next_steps && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-900">Próximos Passos</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {report.next_steps}
                        </p>
                      </div>
                    )}
                    {selected.status === 'contratado' ? (
                      <div className="flex items-center justify-center gap-2 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-700">
                          Candidato contratado
                        </span>
                      </div>
                    ) : (
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12"
                        onClick={() => {
                          const c = selected
                          setSelected(null)
                          openHire(c)
                        }}
                      >
                        <UserCheck className="w-4 h-4 mr-2" /> Contratar
                      </Button>
                    )}
                  </div>
                </>
              )
            })()}
        </SheetContent>
      </Sheet>

      <Dialog
        open={hireStep === 1}
        onOpenChange={(open) => {
          if (!open && !hireLoading) {
            setHireStep(0)
            setHireCand(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Contratar {hireCand?.name} para {jobTitle}?
            </DialogTitle>
            <DialogDescription>
              Esta ação atualizará o status do candidato para "contratado" e registrará o evento no
              histórico.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setHireStep(0)
                setHireCand(null)
              }}
              disabled={hireLoading}
            >
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={confirmHire}
              disabled={hireLoading}
            >
              {hireLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserCheck className="w-4 h-4 mr-2" />
              )}
              Confirmar Contratação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={hireStep === 2}
        onOpenChange={(open) => {
          if (!open && !hireLoading) {
            setHireStep(0)
            setHireCand(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pós-contratação</DialogTitle>
            <DialogDescription>
              {hireCand?.name} foi contratada. Defina os próximos passos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium text-slate-900 mb-2">Fechar a vaga?</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={closeJob ? 'default' : 'outline'}
                  onClick={() => setCloseJob(true)}
                >
                  Sim, fechar
                </Button>
                <Button
                  size="sm"
                  variant={!closeJob ? 'default' : 'outline'}
                  onClick={() => setCloseJob(false)}
                >
                  Manter aberta
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 mb-2">
                O que fazer com os demais entrevistados/analisados?
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={!rejectOthers ? 'default' : 'outline'}
                  onClick={() => setRejectOthers(false)}
                >
                  Manter como estão
                </Button>
                <Button
                  size="sm"
                  variant={rejectOthers ? 'default' : 'outline'}
                  className={rejectOthers ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                  onClick={() => setRejectOthers(true)}
                >
                  Reprovar todos
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={executePostHire}
              disabled={hireLoading}
            >
              {hireLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
