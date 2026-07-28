import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getActiveTenantId } from '@/stores/useActiveContext'
import { cn } from '@/lib/utils'
import {
  FileText,
  Loader2,
  Upload,
  AlertCircle,
  CheckCircle2,
  Target,
  ClipboardList,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Briefcase,
  FlaskConical,
  Trash2,
  Video,
  ArrowRight,
} from 'lucide-react'

type TabId = 'parser' | 'match' | 'prep' | 'analysis' | 'audit'

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: 'parser', label: 'Parser de CV', icon: FileText },
  { id: 'match', label: 'Match CV x Vaga', icon: Target },
  { id: 'prep', label: 'Preparação', icon: ClipboardList },
  { id: 'analysis', label: 'Transcrição e Análise', icon: Activity },
  { id: 'audit', label: 'Auditoria', icon: ShieldCheck },
]

interface AuditEntry {
  id: string
  timestamp: string
  action: string
  mode: string
  payload: string
  result: string
  error: boolean
}

const SAFETY_CHECKLIST = [
  'Não cria candidatos',
  'Não salva transcrições',
  'Não altera scores',
  'Não modifica entrevistas',
  'Não altera agenda',
  'Não modifica Kanban',
  'Não altera status de candidatos',
]

function DryRunBadge() {
  return (
    <Badge className="bg-violet-50 text-violet-700 border border-violet-200 text-xs font-bold">
      <FlaskConical className="w-3 h-3 mr-1" /> DRY-RUN — nada foi gravado
    </Badge>
  )
}

export default function TesteCV() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('parser')
  const tenantId = getActiveTenantId()

  const [vagas, setVagas] = useState<any[]>([])
  const [candidatos, setCandidatos] = useState<any[]>([])
  const [entrevistas, setEntrevistas] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')

  const [selectedVagaId, setSelectedVagaId] = useState('')
  const [selectedCandidatoId, setSelectedCandidatoId] = useState('')
  const [selectedEntrevistaId, setSelectedEntrevistaId] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [parserLoading, setParserLoading] = useState(false)
  const [parserResult, setParserResult] = useState<any>(null)
  const [parserError, setParserError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [matchFile, setMatchFile] = useState<File | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchResult, setMatchResult] = useState<any>(null)
  const [matchError, setMatchError] = useState('')
  const matchFileRef = useRef<HTMLInputElement>(null)

  const [extraContexto, setExtraContexto] = useState('')
  const [prepLoading, setPrepLoading] = useState(false)
  const [prepResult, setPrepResult] = useState<any>(null)
  const [prepError, setPrepError] = useState('')

  const [transcript, setTranscript] = useState('')
  const [roteiroJson, setRoteiroJson] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [scoreBefore, setScoreBefore] = useState<number | null>(null)
  const [scoreAfter, setScoreAfter] = useState<number | null>(null)

  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])

  const selectedVaga = vagas.find((v) => v.id === selectedVagaId)
  const selectedCandidato = candidatos.find((c) => c.id === selectedCandidatoId)
  const selectedEntrevista = entrevistas.find((e) => e.id === selectedEntrevistaId)

  const filteredCandidatos = selectedVagaId
    ? candidatos.filter((c) => c.vaga_id === selectedVagaId)
    : candidatos

  const addAudit = useCallback(
    (action: string, mode: string, payload: string, result: string, error = false) => {
      setAuditLog((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toLocaleString('pt-BR'),
          action,
          mode,
          payload,
          result,
          error,
        },
        ...prev,
      ])
    },
    [],
  )

  useEffect(() => {
    if (!tenantId) return
    const load = async () => {
      setDataLoading(true)
      setDataError('')
      try {
        const [v, c, e] = await Promise.all([
          supabase
            .from('vagas')
            .select('id,titulo,cargo,empresa,descricao,status,data_limite')
            .eq('tenant_id', tenantId)
            .order('criado_em', { ascending: false }),
          supabase
            .from('candidatos')
            .select('id,nome,status,score,cv_texto,cv_url,vaga_id,dados_adicionais,cargo,email')
            .eq('tenant_id', tenantId)
            .order('criado_em', { ascending: false })
            .limit(200),
          supabase
            .from('entrevistas')
            .select('id,status,roteiro,disc,resumo,transcricao,vaga_id,candidato_id,realizada_em')
            .eq('tenant_id', tenantId)
            .order('criado_em', { ascending: false })
            .limit(100),
        ])
        if (v.error) throw v.error
        if (c.error) throw c.error
        if (e.error) throw e.error
        setVagas(v.data || [])
        setCandidatos(c.data || [])
        setEntrevistas(e.data || [])
      } catch (err: any) {
        setDataError(err?.message || 'Erro ao carregar dados')
      } finally {
        setDataLoading(false)
      }
    }
    load()
  }, [tenantId])

  useEffect(() => {
    if (selectedCandidatoId) {
      const c = candidatos.find((x) => x.id === selectedCandidatoId)
      if (c && selectedVagaId && c.vaga_id !== selectedVagaId) setSelectedCandidatoId('')
    }
    if (selectedEntrevistaId) {
      const e = entrevistas.find((x) => x.id === selectedEntrevistaId)
      if (e && selectedVagaId && e.vaga_id !== selectedVagaId) setSelectedEntrevistaId('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVagaId])

  useEffect(() => {
    const e = entrevistas.find((x) => x.id === selectedEntrevistaId)
    setTranscript(e?.transcricao || '')
    const c = e ? candidatos.find((x) => x.id === e.candidato_id) : null
    setScoreBefore(c?.score ?? null)
    setScoreAfter(null)
    setAnalysisResult(null)
    setAnalysisError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntrevistaId])

  const handleParser = async () => {
    if (!file) return
    if (!tenantId) {
      setParserError('Selecione uma empresa antes de testar.')
      return
    }
    setParserLoading(true)
    setParserError('')
    setParserResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('tenant_id', tenantId)
      const { data, error } = await supabase.functions.invoke('extract-cv-info', { body: fd })
      if (error) throw new Error(error.message || String(error))
      if (data?.error) {
        const detail = data.detail ? ` [${data.detail}]` : ''
        throw new Error(`${data.error}${detail}`)
      }
      setParserResult(data)
      addAudit('Parser de CV (dry-run)', 'dry_run', file.name, 'Sucesso', false)
    } catch (err: any) {
      setParserError(err?.message || String(err))
      addAudit('Parser de CV (dry-run)', 'dry_run', file.name, err?.message || 'Erro', true)
    } finally {
      setParserLoading(false)
    }
  }

  const handleMatch = async () => {
    if (!matchFile || !selectedVagaId) return
    setMatchLoading(true)
    setMatchError('')
    setMatchResult(null)
    try {
      const fd = new FormData()
      fd.append('file', matchFile)
      fd.append('vaga_id', selectedVagaId)
      const { data, error } = await supabase.functions.invoke('extract-cv-info', { body: fd })
      if (error) throw new Error(error.message || String(error))
      if (data?.error) {
        const detail = data.detail ? ` [${data.detail}]` : ''
        throw new Error(`${data.error}${detail}`)
      }
      setMatchResult(data)
      addAudit(
        'Match CV x Vaga (dry-run)',
        'dry_run',
        `${matchFile.name} + vaga:${selectedVagaId}`,
        `Score: ${data?.score ?? 'N/A'}`,
        false,
      )
    } catch (err: any) {
      setMatchError(err?.message || String(err))
      addAudit(
        'Match CV x Vaga (dry-run)',
        'dry_run',
        `${matchFile.name} + vaga:${selectedVagaId}`,
        err?.message || 'Erro',
        true,
      )
    } finally {
      setMatchLoading(false)
    }
  }

  const handleGeneratePrep = async () => {
    if (!selectedVagaId || !selectedCandidatoId) return
    setPrepLoading(true)
    setPrepError('')
    setPrepResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('lab-generate-prep', {
        body: {
          vaga_id: selectedVagaId,
          candidato_id: selectedCandidatoId,
          extra_contexto: extraContexto || undefined,
        },
      })
      if (error) throw new Error(error.message || String(error))
      if (data?.error) throw new Error(data.error)
      setPrepResult(data)
      addAudit(
        'Simular preparação (lab-generate-prep)',
        'dry_run',
        `vaga:${selectedVagaId},cand:${selectedCandidatoId}`,
        'Roteiro simulado gerado',
        false,
      )
    } catch (err: any) {
      setPrepError(err?.message || String(err))
      addAudit(
        'Simular preparação (lab-generate-prep)',
        'dry_run',
        `vaga:${selectedVagaId},cand:${selectedCandidatoId}`,
        err?.message || 'Erro',
        true,
      )
    } finally {
      setPrepLoading(false)
    }
  }

  const handleRunAnalysis = async () => {
    if (!selectedVagaId || !selectedCandidatoId || transcript.length < 100) return
    setAnalysisLoading(true)
    setAnalysisError('')
    setAnalysisResult(null)
    const c = candidatos.find((x) => x.id === selectedCandidatoId)
    setScoreBefore(c?.score ?? null)
    try {
      const { data, error } = await supabase.functions.invoke('lab-analyze-interview', {
        body: {
          vaga_id: selectedVagaId,
          candidato_id: selectedCandidatoId,
          transcricao: transcript,
          roteiro_json: roteiroJson || undefined,
        },
      })
      if (error) throw new Error(error.message || String(error))
      if (data?.error) throw new Error(data.error)
      setAnalysisResult(data)
      setScoreAfter(data?.score_simulado ?? null)
      addAudit(
        'Simular análise (lab-analyze-interview)',
        'dry_run',
        `vaga:${selectedVagaId},cand:${selectedCandidatoId},${transcript.length} chars`,
        `Score simulado: ${data?.score_simulado ?? 'N/A'}`,
        false,
      )
    } catch (err: any) {
      setAnalysisError(err?.message || String(err))
      addAudit(
        'Simular análise (lab-analyze-interview)',
        'dry_run',
        `vaga:${selectedVagaId},cand:${selectedCandidatoId}`,
        err?.message || 'Erro',
        true,
      )
    } finally {
      setAnalysisLoading(false)
    }
  }

  const checklist = [
    {
      label: 'CV salvo no banco',
      available: !!selectedCandidato?.cv_texto,
      usedBy: 'extract-cv-info, lab-generate-prep, lab-analyze-interview',
    },
    {
      label: 'Score do CV presente',
      available: selectedCandidato?.score != null,
      usedBy: 'lab-generate-prep, lab-analyze-interview',
    },
    {
      label: 'Descrição da vaga presente',
      available: !!selectedVaga?.descricao,
      usedBy: 'extract-cv-info, lab-generate-prep, lab-analyze-interview',
    },
    {
      label: 'Resumo analítico (dados_adicionais)',
      available: !!selectedCandidato?.dados_adicionais,
      usedBy: 'lab-generate-prep',
    },
    {
      label: 'Transcrição da entrevista',
      available: !!selectedEntrevista?.transcricao,
      usedBy: 'lab-analyze-interview',
    },
    {
      label: 'CV enviado na análise de entrevista',
      available: true,
      usedBy: 'lab-analyze-interview (inclui cv_texto)',
    },
  ]

  const roteiroCategories = prepResult?.categories || []
  const roteiroBriefing = prepResult?.briefing || ''
  const roteiroRedFlags = prepResult?.red_flags || []

  const renderExtraction = (result: any) => {
    if (!result) return null
    const fields = [
      { l: 'Nome', v: result.nome?.valor },
      { l: 'Email', v: result.email?.valor },
      { l: 'Telefone', v: result.telefone?.valor },
      { l: 'LinkedIn', v: result.linkedin?.valor },
      { l: 'Cargo Atual', v: result.cargo_atual?.valor },
      { l: 'Empresa Atual', v: result.empresa_atual?.valor },
      { l: 'Resumo', v: result.resumo?.valor },
      { l: 'Educação', v: result.educacao?.valor },
    ]
    return (
      <div className="space-y-3">
        {result.score != null && (
          <Card className="border-indigo-200 bg-indigo-50/50">
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-indigo-700">Score de Aderência</span>
                <div className="flex items-center gap-2">
                  <DryRunBadge />
                  <Badge
                    className={cn(
                      'text-xs',
                      result.score >= 70
                        ? 'bg-emerald-50 text-emerald-600'
                        : result.score >= 40
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-red-50 text-red-600',
                    )}
                  >
                    {result.score}/100
                  </Badge>
                </div>
              </div>
              {result.score_raciocinio && (
                <p className="text-xs text-slate-600">{result.score_raciocinio}</p>
              )}
              {result.score_confianca != null && (
                <span className="text-[10px] text-slate-400">
                  Confiança: {Math.round(result.score_confianca * 100)}%
                </span>
              )}
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {fields.map((f) => (
            <div key={f.l} className="border rounded-md p-2">
              <span className="text-[10px] font-medium text-slate-400 uppercase">{f.l}</span>
              <p className="text-sm text-slate-700">{f.v || '—'}</p>
            </div>
          ))}
        </div>
        {result.habilidades?.valor?.length > 0 && (
          <div className="border rounded-md p-2">
            <span className="text-[10px] font-medium text-slate-400 uppercase">Habilidades</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {result.habilidades.valor.map((s: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {result.vaga_alerta && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700">
              {result.vaga_alerta}
            </AlertDescription>
          </Alert>
        )}
        {result.resumo_analitico && (
          <div className="border rounded-md p-3 space-y-1">
            <span className="text-[10px] font-medium text-slate-400 uppercase">
              Resumo Analítico
            </span>
            {result.resumo_analitico.professional_dna && (
              <p className="text-xs text-slate-600">
                <strong>DNA:</strong> {result.resumo_analitico.professional_dna}
              </p>
            )}
            {result.resumo_analitico.profile && (
              <p className="text-xs text-slate-600">
                <strong>Perfil:</strong> {result.resumo_analitico.profile}
              </p>
            )}
            {result.resumo_analitico.strengths?.length > 0 && (
              <p className="text-xs text-slate-600">
                <strong>Pontos fortes:</strong> {result.resumo_analitico.strengths.join(', ')}
              </p>
            )}
            {result.resumo_analitico.investigation_points?.length > 0 && (
              <p className="text-xs text-slate-600">
                <strong>Investigar:</strong>{' '}
                {result.resumo_analitico.investigation_points.join(', ')}
              </p>
            )}
          </div>
        )}
        <details className="border rounded-md">
          <summary className="text-xs font-medium text-slate-500 cursor-pointer p-2">
            JSON completo
          </summary>
          <pre className="bg-slate-900 text-slate-100 text-xs rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      </div>
    )
  }

  const renderFileUpload = (
    ref: React.RefObject<HTMLInputElement>,
    selectedFile: File | null,
    onSelect: (f: File | null) => void,
  ) => (
    <div
      className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-400 transition-colors"
      onClick={() => ref.current?.click()}
    >
      <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
      <p className="text-sm text-slate-600 font-medium">
        {selectedFile ? selectedFile.name : 'Clique para selecionar um PDF'}
      </p>
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        className="hidden"
      />
    </div>
  )

  const renderSummaryCard = (
    title: string,
    icon: typeof FileText,
    items: { label: string; value: string | null }[],
  ) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-1.5 text-slate-500">
          {(() => {
            const I = icon
            return <I className="w-3.5 h-3.5" />
          })()}{' '}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((it, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-slate-400">{it.label}</span>
            <span className="font-medium text-slate-700 text-right">{it.value || '—'}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )

  const vagaItems = vagas.map((v) => ({
    id: v.id,
    label: `${v.titulo}${v.empresa ? ' · ' + v.empresa : ''}`,
  }))
  const candItems = filteredCandidatos.map((c) => ({
    id: c.id,
    label: `${c.nome || 'Sem nome'}${c.score != null ? ' (' + c.score + ')' : ''}`,
  }))

  const discData = analysisResult?.disc
  const relatorio = analysisResult?.relatorio

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-violet-600" />
          <h1 className="text-2xl font-bold text-slate-900">Testes AI</h1>
        </div>
        <p className="text-sm text-slate-500">
          Laboratório de testes de funções de IA — todas as operações rodam em memória e nada é
          gravado no banco de dados.
        </p>
      </div>

      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1 space-y-0.5">
            <h2 className="text-sm font-semibold text-slate-900">Bancada de entrevista ao vivo</h2>
            <p className="text-xs text-slate-600">
              Sala de vídeo com gravação, transcrição rotulada e análise DISC. O candidato entra por
              link, sem conta. Nada é gravado no banco.
            </p>
          </div>
          <Button
            onClick={() => navigate('/bancada-entrevista')}
            className="flex-shrink-0 bg-violet-600 hover:bg-violet-700"
          >
            Abrir a bancada <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </CardContent>
      </Card>

      <Card className="border-violet-200 bg-violet-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-semibold text-violet-700">Checklist de Segurança</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {SAFETY_CHECKLIST.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-xs text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {dataError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{dataError}</AlertDescription>
        </Alert>
      )}

      {dataLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando dados do tenant...
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-px">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md transition-colors',
                activeTab === t.id
                  ? 'bg-violet-50 text-violet-700 border-b-2 border-violet-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50',
              )}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'parser' && (
        <div className="space-y-4">
          <Alert className="border-violet-200 bg-violet-50">
            <FlaskConical className="w-4 h-4 text-violet-600" />
            <AlertDescription className="text-xs text-violet-700">
              Este teste envia o PDF para a função extract-cv-info e apenas exibe o JSON retornado.
              Nenhum candidato é criado ou modificado.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Arquivo PDF — Parser Standalone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderFileUpload(fileInputRef, file, setFile)}
              <Button
                onClick={handleParser}
                disabled={!file || parserLoading}
                className="w-full sm:w-auto"
              >
                {parserLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testando...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" /> Testar extração
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
          {parserError && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{parserError}</AlertDescription>
            </Alert>
          )}
          {parserResult && !parserError && (
            <Alert>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>
                Extração concluída com sucesso — nada foi gravado.
              </AlertDescription>
            </Alert>
          )}
          {parserResult && renderExtraction(parserResult)}
        </div>
      )}

      {activeTab === 'match' && (
        <div className="space-y-4">
          <Alert className="border-violet-200 bg-violet-50">
            <FlaskConical className="w-4 h-4 text-violet-600" />
            <AlertDescription className="text-xs text-violet-700">
              Este teste não grava candidato. Ele apenas envia o CV e a vaga para a função
              extract-cv-info e exibe o retorno.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match CV x Vaga</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Selecionar Vaga</Label>
                {vagaItems.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhuma vaga encontrada.</p>
                ) : (
                  <Select value={selectedVagaId} onValueChange={setSelectedVagaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma vaga" />
                    </SelectTrigger>
                    <SelectContent>
                      {vagaItems.map((it) => (
                        <SelectItem key={it.id} value={it.id}>
                          {it.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {selectedVaga &&
                renderSummaryCard('Vaga Selecionada', Briefcase, [
                  { label: 'Título', value: selectedVaga.titulo },
                  { label: 'Cargo', value: selectedVaga.cargo },
                  { label: 'Empresa', value: selectedVaga.empresa },
                  { label: 'Status', value: selectedVaga.status },
                ])}
              <Separator />
              {renderFileUpload(matchFileRef, matchFile, setMatchFile)}
              <Button
                onClick={handleMatch}
                disabled={!matchFile || !selectedVagaId || matchLoading}
                className="w-full sm:w-auto"
              >
                {matchLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testando...
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4 mr-2" /> Testar match
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
          {matchError && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{matchError}</AlertDescription>
            </Alert>
          )}
          {matchResult && !matchError && (
            <Alert>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>
                Match concluído. Score: {matchResult.score ?? 'N/A'}/100 — nada foi gravado.
              </AlertDescription>
            </Alert>
          )}
          {matchResult && renderExtraction(matchResult)}
        </div>
      )}

      {activeTab === 'prep' && (
        <div className="space-y-4">
          <Alert className="border-violet-200 bg-violet-50">
            <FlaskConical className="w-4 h-4 text-violet-600" />
            <AlertDescription className="text-xs text-violet-700">
              Esta aba usa a função laboratorial <strong>lab-generate-prep</strong>. Ela gera o
              roteiro em memória e não grava nada no banco de dados.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Vaga</Label>
              {vagaItems.length === 0 ? (
                <p className="text-xs text-slate-400">Sem dados</p>
              ) : (
                <Select value={selectedVagaId} onValueChange={setSelectedVagaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {vagaItems.map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">
                Candidato {selectedVagaId ? `(filtrado)` : ''}
              </Label>
              {candItems.length === 0 ? (
                <p className="text-xs text-slate-400">
                  {selectedVagaId ? 'Nenhum candidato nesta vaga' : 'Selecione uma vaga'}
                </p>
              ) : (
                <Select value={selectedCandidatoId} onValueChange={setSelectedCandidatoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {candItems.map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedVaga &&
              renderSummaryCard('Vaga', Briefcase, [
                { label: 'Título', value: selectedVaga.titulo },
                { label: 'Status', value: selectedVaga.status },
                { label: 'Desc. tamanho', value: `${selectedVaga.descricao?.length || 0} chars` },
              ])}
            {selectedCandidato &&
              renderSummaryCard('Candidato', FileText, [
                { label: 'Nome', value: selectedCandidato.nome },
                { label: 'Status', value: selectedCandidato.status },
                {
                  label: 'Score',
                  value: selectedCandidato.score != null ? String(selectedCandidato.score) : null,
                },
                { label: 'CV tamanho', value: `${selectedCandidato.cv_texto?.length || 0} chars` },
              ])}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Contexto Adicional (opcional)</Label>
            <Textarea
              value={extraContexto}
              onChange={(e) => setExtraContexto(e.target.value)}
              placeholder="Adicione contexto extra para guiar a geração do roteiro simulado..."
              className="min-h-[80px] text-sm"
            />
          </div>

          <Button
            onClick={handleGeneratePrep}
            disabled={prepLoading || !selectedVagaId || !selectedCandidatoId}
            className="w-full sm:w-auto"
          >
            {prepLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Simulando...
              </>
            ) : (
              <>
                <FlaskConical className="w-4 h-4 mr-2" /> Simular preparação
              </>
            )}
          </Button>

          {prepError && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{prepError}</AlertDescription>
            </Alert>
          )}

          {roteiroCategories.length > 0 && (
            <Card>
              <CardHeader className="bg-slate-50 border-b pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-600" /> Roteiro de Perguntas (Simulado)
                  <DryRunBadge />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {roteiroBriefing && (
                  <div className="bg-violet-50 border border-violet-100 rounded-md p-3">
                    <span className="text-[10px] font-bold text-violet-700 uppercase">
                      Briefing
                    </span>
                    <p className="text-xs text-slate-700 mt-1">{roteiroBriefing}</p>
                  </div>
                )}
                {roteiroCategories.map((cat: any, i: number) => (
                  <div key={i} className="space-y-1.5">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 pb-1 border-b">
                      <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px]">
                        {i + 1}
                      </span>
                      {cat.category || cat.name}
                    </h3>
                    {(cat.questions || []).map((q: any, j: number) => (
                      <div key={j} className="bg-white border rounded-md p-2.5 space-y-1">
                        <p className="text-sm font-medium text-slate-900">{q.text}</p>
                        <p className="text-xs text-slate-500">
                          <strong>Competência:</strong> {q.competency}
                        </p>
                        <p className="text-xs text-slate-500">
                          <strong>Indicadores:</strong> {q.indicators}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
                {roteiroRedFlags.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                    <span className="text-[10px] font-bold text-amber-700 uppercase flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Sinais de Alerta
                    </span>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs text-amber-800">
                      {roteiroRedFlags.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="space-y-4">
          <Alert className="border-violet-200 bg-violet-50">
            <FlaskConical className="w-4 h-4 text-violet-600" />
            <AlertDescription className="text-xs text-violet-700">
              Esta aba usa a função laboratorial <strong>lab-analyze-interview</strong>. A análise é
              feita em memória e não atualiza candidatos, scores, entrevistas ou eventos.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Vaga</Label>
              {vagaItems.length === 0 ? (
                <p className="text-xs text-slate-400">Sem dados</p>
              ) : (
                <Select value={selectedVagaId} onValueChange={setSelectedVagaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {vagaItems.map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">
                Candidato {selectedVagaId ? `(filtrado)` : ''}
              </Label>
              {candItems.length === 0 ? (
                <p className="text-xs text-slate-400">
                  {selectedVagaId ? 'Nenhum candidato nesta vaga' : 'Selecione uma vaga'}
                </p>
              ) : (
                <Select value={selectedCandidatoId} onValueChange={setSelectedCandidatoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {candItems.map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {selectedCandidato &&
            renderSummaryCard('Candidato', FileText, [
              { label: 'Nome', value: selectedCandidato.nome },
              {
                label: 'Score atual',
                value: selectedCandidato.score != null ? String(selectedCandidato.score) : null,
              },
              { label: 'CV tamanho', value: `${selectedCandidato.cv_texto?.length || 0} chars` },
            ])}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Transcrição Manual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Cole aqui a transcrição da entrevista (mín. 100 caracteres)..."
                className="min-h-[180px] text-sm"
              />
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Roteiro JSON (opcional)</Label>
                <Textarea
                  value={roteiroJson}
                  onChange={(e) => setRoteiroJson(e.target.value)}
                  placeholder="Cole o JSON do roteiro para contextualizar a análise (opcional)..."
                  className="min-h-[60px] text-xs font-mono"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-xs',
                    transcript.length < 100 ? 'text-amber-600' : 'text-slate-500',
                  )}
                >
                  {transcript.length} caracteres {transcript.length < 100 && '(mín. 100)'}
                </span>
                <Button
                  size="sm"
                  onClick={handleRunAnalysis}
                  disabled={
                    analysisLoading ||
                    !selectedVagaId ||
                    !selectedCandidatoId ||
                    transcript.length < 100
                  }
                >
                  {analysisLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Simulando...
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5 mr-1.5" /> Simular análise da transcrição
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {analysisError && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{analysisError}</AlertDescription>
            </Alert>
          )}

          {(scoreBefore !== null || scoreAfter !== null) && (
            <Card className="border-violet-100">
              <CardContent className="p-3 flex items-center gap-4 text-sm flex-wrap">
                <DryRunBadge />
                <div>
                  <span className="text-xs text-slate-400">Score atual (banco):</span>{' '}
                  <Badge variant="outline">{scoreBefore ?? '—'}</Badge>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Score simulado:</span>{' '}
                  <Badge
                    className={cn(
                      'text-xs',
                      (scoreAfter ?? 0) >= 70
                        ? 'bg-emerald-50 text-emerald-600'
                        : (scoreAfter ?? 0) >= 40
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-red-50 text-red-600',
                    )}
                  >
                    {scoreAfter ?? '—'}
                  </Badge>
                </div>
                {scoreBefore !== null && scoreAfter !== null && (
                  <span className="text-xs text-slate-500">
                    Δ {scoreAfter - scoreBefore > 0 ? '+' : ''}
                    {scoreAfter - scoreBefore}
                  </span>
                )}
              </CardContent>
            </Card>
          )}

          {analysisResult && discData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Perfil DISC (Simulado) <DryRunBadge />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {discData.profile && (
                  <Badge className="bg-violet-50 text-violet-700">{discData.profile}</Badge>
                )}
                {['D', 'I', 'S', 'C'].map((k) => {
                  const val = discData[k] || 0
                  const colors: Record<string, string> = {
                    D: 'bg-[#E63946]',
                    I: 'bg-[#F77F00]',
                    S: 'bg-[#06A77D]',
                    C: 'bg-[#457B9D]',
                  }
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <span className="w-4 text-xs font-bold text-slate-700">{k}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn('h-full', colors[k])} style={{ width: `${val}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs font-medium text-slate-600">
                        {val}%
                      </span>
                    </div>
                  )
                })}
                {discData.confidence != null && (
                  <p className="text-[10px] text-slate-400">
                    Confiança: {Math.round(discData.confidence * 100)}%
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {analysisResult && analysisResult.competencyMatch?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Match de Competências (Simulado)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysisResult.competencyMatch.map((cm: any, i: number) => (
                  <div key={i} className="border rounded-md p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{cm.competency}</span>
                      <Badge
                        className={cn(
                          'text-xs',
                          cm.match >= 70
                            ? 'bg-emerald-50 text-emerald-600'
                            : cm.match >= 40
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-red-50 text-red-600',
                        )}
                      >
                        {cm.match}%
                      </Badge>
                    </div>
                    {cm.evidence && <p className="text-xs text-slate-500">{cm.evidence}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {analysisResult && relatorio && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Relatório de Análise (Simulado) <DryRunBadge />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {relatorio.executive_summary && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Resumo Executivo
                    </span>
                    <p className="text-sm text-slate-700 mt-1 bg-slate-50 p-2 rounded">
                      {relatorio.executive_summary}
                    </p>
                  </div>
                )}
                {relatorio.recommendation && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Recomendação
                    </span>
                    <Badge variant="outline" className="text-sm">
                      {relatorio.recommendation}
                    </Badge>
                  </div>
                )}
                {relatorio.strengths?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">
                      Pontos Fortes
                    </span>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5 text-sm text-slate-700">
                      {relatorio.strengths.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {relatorio.risks?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-amber-600 uppercase">Riscos</span>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5 text-sm text-slate-700">
                      {relatorio.risks.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {relatorio.next_steps && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Próximos Passos
                    </span>
                    <p className="text-sm text-slate-700 mt-1">{relatorio.next_steps}</p>
                  </div>
                )}
                {analysisResult.speechConsistency && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Consistência do Discurso
                    </span>
                    <p className="text-sm text-slate-700 mt-1 bg-slate-50 p-2 rounded">
                      Score: {analysisResult.speechConsistency.score}/100 —{' '}
                      {analysisResult.speechConsistency.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {analysisResult && (
            <details className="border rounded-md">
              <summary className="text-xs font-medium text-slate-500 cursor-pointer p-2">
                JSON da análise simulada
              </summary>
              <pre className="bg-slate-900 text-slate-100 text-xs rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
                {JSON.stringify(analysisResult, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-violet-600" /> Checklist de Inputs da IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {checklist.map((item, i) => (
                <div key={i} className="flex items-center justify-between border rounded-md p-2">
                  <div className="flex items-center gap-2">
                    {item.available ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-slate-300" />
                    )}
                    <span
                      className={cn(
                        'text-sm',
                        item.available ? 'text-slate-700' : 'text-slate-400',
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.available ? (
                      <Badge className="bg-emerald-50 text-emerald-600 text-[10px]">
                        Disponível
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-slate-400">
                        Indisponível
                      </Badge>
                    )}
                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                      {item.usedBy}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <AlertDescription className="text-xs text-emerald-700">
              Todas as funções laboratoriais (lab-generate-prep e lab-analyze-interview) utilizam
              apenas <code>.select()</code> e nunca gravam no banco de dados. O CV completo do
              candidato agora é enviado para a análise de entrevista.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-600" /> Log de Auditoria Local (sessão)
                </CardTitle>
                {auditLog.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setAuditLog([])}>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Limpar auditoria local
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {auditLog.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Nenhuma ação registrada ainda.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {auditLog.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        'border rounded-md p-2 text-xs',
                        entry.error
                          ? 'border-red-200 bg-red-50/50'
                          : 'border-slate-200 bg-slate-50/50',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-400">{entry.timestamp}</span>
                        <Badge
                          className={cn(
                            'text-[10px]',
                            entry.error
                              ? 'bg-red-50 text-red-600'
                              : 'bg-emerald-50 text-emerald-600',
                          )}
                        >
                          {entry.error ? 'Erro' : 'OK'}
                        </Badge>
                        <span className="font-medium text-slate-700">{entry.action}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {entry.mode}
                        </Badge>
                      </div>
                      <div className="mt-1 text-slate-500">
                        <strong>Payload:</strong> {entry.payload}
                      </div>
                      <div className="text-slate-500">
                        <strong>Resultado:</strong> {entry.result}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
