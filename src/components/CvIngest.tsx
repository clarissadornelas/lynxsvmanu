import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Save, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ExtractionField {
  valor: string | null
  confidence: number
}

interface ExtractionResult {
  nome: ExtractionField
  email: ExtractionField
  telefone: ExtractionField
  linkedin: ExtractionField
  cargo_atual: ExtractionField
  empresa_atual: ExtractionField
  resumo: ExtractionField
  habilidades: { valor: string[] | null; confidence: number }
  educacao: ExtractionField
  idioma_detectado?: string
  score?: number | null
  score_raciocinio?: string | null
  score_confianca?: number | null
  vaga_qualidade?: number | null
  vaga_alerta?: string | null
  resumo_analitico?: {
    professional_dna: string
    profile: string
    strengths: string[]
    metrics: string[]
    achievements: string[]
    investigation_points: string[]
  }
  needs_review?: string[]
  error?: string
}

interface ReviewItem {
  id: string
  fileName: string
  status: 'pending' | 'extracting' | 'ready' | 'error' | 'saved'
  extraction: ExtractionResult | null
  errorMessage: string | null
}

interface CvIngestProps {
  vagaId: string
  tenantId: string
  onDone?: () => void
}

const MAX_FILES = 10

function buildCvTexto(ex: ExtractionResult): string {
  const blocks: string[] = []

  if (ex.nome?.valor) {
    blocks.push(ex.nome.valor)
  }

  const cargoEmpresa = [ex.cargo_atual?.valor, ex.empresa_atual?.valor].filter(Boolean).join(' — ')
  if (cargoEmpresa) {
    blocks.push(cargoEmpresa)
  }

  const contato = [ex.email?.valor, ex.telefone?.valor, ex.linkedin?.valor]
    .filter(Boolean)
    .join(' · ')
  if (contato) {
    blocks.push(contato)
  }

  if (ex.resumo?.valor) {
    blocks.push(`RESUMO\n${ex.resumo.valor}`)
  }

  if (ex.habilidades?.valor && ex.habilidades.valor.length > 0) {
    const skillsList = ex.habilidades.valor.map((s) => `• ${s}`).join('\n')
    blocks.push(`HABILIDADES\n${skillsList}`)
  }

  if (ex.educacao?.valor) {
    blocks.push(`FORMAÇÃO\n${ex.educacao.valor}`)
  }

  return blocks.join('\n\n')
}

function FieldRow({
  label,
  field,
  isEditable,
  value,
  onChange,
}: {
  label: string
  field: ExtractionField
  isEditable: boolean
  value: string
  onChange?: (v: string) => void
}) {
  const lowConfidence = field.confidence < 0.7
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-slate-500">{label}</Label>
        <div className="flex items-center gap-1">
          {lowConfidence && <AlertTriangle className="w-3 h-3 text-amber-500" />}
          <span
            className={cn(
              'text-[10px] font-medium',
              lowConfidence ? 'text-amber-600' : 'text-slate-400',
            )}
          >
            {Math.round(field.confidence * 100)}%
          </span>
        </div>
      </div>
      {isEditable ? (
        <Input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn('h-8 text-sm', lowConfidence && 'border-amber-300 bg-amber-50')}
        />
      ) : (
        <p className="text-sm text-slate-600 min-h-[1.5rem]">{field.valor || '—'}</p>
      )}
    </div>
  )
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return null
  const color =
    score >= 70
      ? 'bg-emerald-50 text-emerald-600'
      : score >= 40
        ? 'bg-amber-50 text-amber-600'
        : 'bg-red-50 text-red-600'
  return <Badge className={cn('text-xs', color)}>{score}/100</Badge>
}

// Photo uploads are intentionally excluded from bulk CV ingest.
// Candidate photos are managed individually via NewCandidateModal and CandidateProfile.
export function CvIngest({ vagaId, tenantId, onDone }: CvIngestProps) {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [countBefore, setCountBefore] = useState<number | null>(null)
  const [countAfter, setCountAfter] = useState<number | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const [failedSaves, setFailedSaves] = useState<string[]>([])
  const [vagaAlerta, setVagaAlerta] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length === 0) return

      if (files.length > MAX_FILES) {
        toast.error(`Máximo de ${MAX_FILES} arquivos por vez`)
        return
      }

      const pdfFiles = files.filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
      )
      if (pdfFiles.length !== files.length) {
        toast.warning('Apenas arquivos PDF são aceitos')
      }
      if (pdfFiles.length === 0) return

      setIsProcessing(true)
      setProgress(0)
      setVagaAlerta(null)

      const newItems: ReviewItem[] = pdfFiles.map((f, i) => ({
        id: `${Date.now()}-${i}`,
        fileName: f.name,
        status: 'extracting',
        extraction: null,
        errorMessage: null,
      }))
      setItems(newItems)

      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i]
        const itemId = newItems[i].id

        try {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('vaga_id', vagaId)

          const { data, error } = await supabase.functions.invoke('extract-cv-info', {
            body: fd,
          })

          if (error) {
            throw new Error(error.message || String(error))
          }

          if (data?.error) {
            throw new Error(data.error)
          }

          const extraction = data as ExtractionResult

          if (extraction.vaga_alerta && !vagaAlerta) {
            setVagaAlerta(extraction.vaga_alerta)
            toast.warning(extraction.vaga_alerta)
          }

          setItems((prev) =>
            prev.map((it) => (it.id === itemId ? { ...it, status: 'ready', extraction } : it)),
          )
        } catch (err: any) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    status: 'error',
                    errorMessage: err?.message || 'Falha na extração',
                  }
                : it,
            ),
          )
        }

        setProgress(Math.round(((i + 1) / pdfFiles.length) * 100))
      }

      setIsProcessing(false)
      e.target.value = ''
    },
    [vagaId, vagaAlerta],
  )

  const updateFieldValue = useCallback((itemId: string, fieldKey: string, value: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId || !it.extraction) return it
        const field = it.extraction[fieldKey as keyof ExtractionResult] as ExtractionField
        if (!field || typeof field !== 'object') return it
        return {
          ...it,
          extraction: {
            ...it.extraction,
            [fieldKey]: { ...field, valor: value },
          },
        }
      }),
    )
  }, [])

  const handleSaveAll = useCallback(async () => {
    const readyItems = items.filter((it) => it.status === 'ready' && it.extraction)
    if (readyItems.length === 0) {
      toast.info('Nenhum candidato pronto para gravar')
      return
    }

    setIsSaving(true)
    setFailedSaves([])
    setSavedCount(0)

    const { count: before } = await supabase
      .from('candidatos')
      .select('*', { count: 'exact', head: true })
      .eq('vaga_id', vagaId)

    setCountBefore(before ?? 0)

    let successCount = 0
    const failures: string[] = []

    for (const item of readyItems) {
      const ex = item.extraction!
      const cvTexto = buildCvTexto(ex)

      const insertData = {
        tenant_id: tenantId,
        vaga_id: vagaId,
        nome: ex.nome?.valor || null,
        email: ex.email?.valor || null,
        telefone: ex.telefone?.valor || null,
        linkedin: ex.linkedin?.valor || null,
        cargo: ex.cargo_atual?.valor || null,
        empresa: ex.empresa_atual?.valor || null,
        status: 'novo',
        origem: 'cv_upload',
        cv_texto: cvTexto || null,
        score: ex.score ?? null,
        score_obs: ex.score_raciocinio || null,
        dados_adicionais: ex.resumo_analitico ? JSON.stringify(ex.resumo_analitico) : null,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('candidatos')
        .insert(insertData)
        .select('id')
        .single()

      if (insertError || !inserted) {
        failures.push(ex.nome?.valor || item.fileName)
        continue
      }

      const { error: eventError } = await supabase.from('candidato_eventos').insert({
        candidato_id: inserted.id,
        vaga_id: vagaId,
        tenant_id: tenantId,
        tipo: 'candidato_adicionado',
        para: 'novo',
        agente: 'assessor',
        ator: 'upload_cv',
      })

      if (eventError) {
        console.error('Event insert failed for candidate', inserted.id, eventError)
      }

      if (ex.score_raciocinio) {
        const { error: scoreEventError } = await supabase.from('candidato_eventos').insert({
          candidato_id: inserted.id,
          vaga_id: vagaId,
          tenant_id: tenantId,
          tipo: 'score_calculado',
          agente: 'assessor',
          ator: 'ia_score',
          payload: {
            score: ex.score ?? null,
            confianca: ex.score_confianca ?? null,
            raciocinio: ex.score_raciocinio,
          },
        })

        if (scoreEventError) {
          console.error('Score event insert failed for candidate', inserted.id, scoreEventError)
        }
      }

      successCount++
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: 'saved' } : it)))
    }

    const { count: after } = await supabase
      .from('candidatos')
      .select('*', { count: 'exact', head: true })
      .eq('vaga_id', vagaId)

    setCountAfter(after ?? 0)
    setSavedCount(successCount)
    setFailedSaves(failures)
    setIsSaving(false)

    if (successCount > 0) {
      toast.success(`${successCount} candidato(s) gravado(s) com sucesso`)
    }
    if (failures.length > 0) {
      toast.error(`Falha ao gravar: ${failures.join(', ')}`)
    }

    onDone?.()
  }, [items, vagaId, tenantId, onDone])

  const readyCount = items.filter((it) => it.status === 'ready').length
  const errorCount = items.filter((it) => it.status === 'error').length

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-400 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
        <p className="text-sm text-slate-600 font-medium">
          Enviar até {MAX_FILES} PDFs de currículos
        </p>
        <p className="text-xs text-slate-400 mt-1">
          A IA extrai os dados e calcula aderência à vaga
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {vagaAlerta && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-xs text-amber-700">{vagaAlerta}</AlertDescription>
        </Alert>
      )}

      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Extraindo dados e calculando score...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {countBefore !== null && countAfter !== null && (
        <Alert>
          <AlertDescription>
            <div className="flex items-center gap-4 text-xs">
              <span>
                Antes: <strong>{countBefore}</strong>
              </span>
              <span>
                Depois: <strong>{countAfter}</strong>
              </span>
              <span className="text-emerald-600">
                Gravados: <strong>{savedCount}</strong>
              </span>
              {failedSaves.length > 0 && (
                <span className="text-red-600">
                  Falhas: <strong>{failedSaves.length}</strong>
                </span>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {items.length > 0 && (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'border rounded-lg p-3 space-y-3',
                item.status === 'error' && 'border-red-200 bg-red-50/50',
                item.status === 'saved' && 'border-emerald-200 bg-emerald-50/50',
                item.status === 'ready' && 'border-slate-200',
                item.status === 'extracting' && 'border-slate-200 bg-slate-50',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                    {item.fileName}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {item.status === 'extracting' && (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  )}
                  {item.status === 'ready' && (
                    <>
                      <ScoreBadge score={item.extraction?.score} />
                      <Badge className="bg-blue-50 text-blue-600 text-xs">Revisar</Badge>
                    </>
                  )}
                  {item.status === 'error' && (
                    <Badge className="bg-red-50 text-red-600 text-xs">Erro</Badge>
                  )}
                  {item.status === 'saved' && (
                    <Badge className="bg-emerald-50 text-emerald-600 text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Gravado
                    </Badge>
                  )}
                </div>
              </div>

              {item.status === 'error' && (
                <div className="flex items-start gap-2 text-xs text-red-600">
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{item.errorMessage}</span>
                </div>
              )}

              {item.status === 'extracting' && (
                <p className="text-xs text-slate-400">Processando com IA...</p>
              )}

              {item.status === 'ready' && item.extraction && (
                <div className="space-y-3">
                  {item.extraction.score_raciocinio && (
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-md p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-indigo-700">
                          Análise de Aderência
                        </span>
                        <ScoreBadge score={item.extraction.score} />
                      </div>
                      <p className="text-xs text-slate-600">{item.extraction.score_raciocinio}</p>
                      {item.extraction.score_confianca !== null &&
                        item.extraction.score_confianca !== undefined && (
                          <span className="text-[10px] text-slate-400">
                            Confiança: {Math.round(item.extraction.score_confianca * 100)}%
                          </span>
                        )}
                    </div>
                  )}
                  <FieldRow
                    label="Nome"
                    field={item.extraction.nome}
                    isEditable
                    value={item.extraction.nome?.valor || ''}
                    onChange={(v) => updateFieldValue(item.id, 'nome', v)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow
                      label="Email"
                      field={item.extraction.email}
                      isEditable
                      value={item.extraction.email?.valor || ''}
                      onChange={(v) => updateFieldValue(item.id, 'email', v)}
                    />
                    <FieldRow
                      label="Telefone"
                      field={item.extraction.telefone}
                      isEditable
                      value={item.extraction.telefone?.valor || ''}
                      onChange={(v) => updateFieldValue(item.id, 'telefone', v)}
                    />
                  </div>
                  <FieldRow
                    label="Cargo Atual"
                    field={item.extraction.cargo_atual}
                    isEditable={false}
                    value=""
                  />
                  <FieldRow
                    label="Empresa Atual"
                    field={item.extraction.empresa_atual}
                    isEditable={false}
                    value=""
                  />
                  <FieldRow
                    label="Resumo"
                    field={item.extraction.resumo}
                    isEditable={false}
                    value=""
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {readyCount > 0 && (
        <Button onClick={handleSaveAll} disabled={isSaving} className="w-full">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Gravando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Gravar todos ({readyCount})
            </>
          )}
        </Button>
      )}

      {items.length > 0 && readyCount === 0 && errorCount > 0 && !isProcessing && (
        <p className="text-xs text-center text-slate-400">
          Nenhum candidato pronto para gravar. Verifique os erros acima.
        </p>
      )}
    </div>
  )
}
