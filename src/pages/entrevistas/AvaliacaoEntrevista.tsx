import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/PageHeader'
import { Loader2, Save, FileText, CheckSquare, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import {
  resolverPerguntas,
  montarAvaliacaoVazia,
  parseAvaliacao,
  parsePerguntas,
  parseEtapas,
  NOTAS_AVALIACAO,
  notaECobertura,
  formatarNotaCobertura,
  type AvaliacaoEntrevista as Avaliacao,
  type PerguntaEtapa,
  type RespostaAvaliacao,
} from '@/lib/funnel-phases'

function extrairPerguntasConfig(
  ppRaw: unknown,
  roundType: string,
): { casa: PerguntaEtapa[]; vaga: PerguntaEtapa[] } {
  let casa: PerguntaEtapa[] = []
  let vaga: PerguntaEtapa[] = []
  if (!ppRaw || typeof ppRaw !== 'object') return { casa, vaga }
  const obj = ppRaw as Record<string, unknown>
  if (Array.isArray(obj[roundType])) {
    casa = parsePerguntas(obj[roundType])
  } else if (obj[roundType] && typeof obj[roundType] === 'object') {
    const sub = obj[roundType] as Record<string, unknown>
    if (Array.isArray(sub.casa)) casa = parsePerguntas(sub.casa)
    if (Array.isArray(sub.vaga)) vaga = parsePerguntas(sub.vaga)
    if (Array.isArray(sub.perguntas)) casa = parsePerguntas(sub.perguntas)
  } else if (Array.isArray(obj.casa) || Array.isArray(obj.vaga)) {
    if (Array.isArray(obj.casa)) casa = parsePerguntas(obj.casa)
    if (Array.isArray(obj.vaga)) vaga = parsePerguntas(obj.vaga)
  } else if (Array.isArray(obj)) {
    casa = parsePerguntas(obj)
  } else if (Array.isArray(obj.perguntas)) {
    casa = parsePerguntas(obj.perguntas)
  }
  return { casa, vaga }
}

export default function AvaliacaoEntrevista() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [candidatoNome, setCandidatoNome] = useState('')
  const [vagaTitulo, setVagaTitulo] = useState('')
  const [rodadaNome, setRodadaNome] = useState('')
  const [perguntas, setPerguntas] = useState<PerguntaEtapa[]>([])
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null)
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    async function loadData() {
      if (!id) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const { data: ent, error } = await supabase
        .from('entrevistas')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error || !ent) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const [{ data: cand }, { data: vaga }] = await Promise.all([
        supabase.from('candidatos').select('nome').eq('id', ent.candidato_id).maybeSingle(),
        supabase.from('vagas').select('titulo, etapas').eq('id', ent.vaga_id).maybeSingle(),
      ])
      setCandidatoNome(cand?.nome || '—')
      setVagaTitulo(vaga?.titulo || '—')

      const etapas = parseEtapas(vaga?.etapas)
      const rodada = ent.rodada || 1
      const etapa = etapas.find((e) => e.n === rodada) || null
      setRodadaNome(etapa?.nome || `Rodada ${rodada}`)
      const roundType = etapa?.tipo || 'rh'

      const { data: config } = await supabase
        .from('configuracoes_agente')
        .select('perguntas_padrao')
        .eq('tenant_id', ent.tenant_id)
        .eq('agent_type', 'copiloto')
        .maybeSingle()

      const { casa, vaga: vagaQ } = extrairPerguntasConfig(config?.perguntas_padrao, roundType)

      let vagaQuestions = vagaQ
      if (vaga?.etapas && Array.isArray(vaga.etapas)) {
        const etapaRaw = (vaga.etapas as Record<string, unknown>[]).find((e) => e?.n === rodada)
        if (etapaRaw && Array.isArray(etapaRaw.perguntas)) {
          vagaQuestions = parsePerguntas(etapaRaw.perguntas)
        }
      }

      const resolved = resolverPerguntas(casa, vagaQuestions)
      setPerguntas(resolved)

      const existing = parseAvaliacao(ent.avaliacao)
      if (existing && existing.respostas.length > 0) {
        setAvaliacao(existing)
        setObservacoes(existing.observacoes || '')
      } else {
        setAvaliacao(montarAvaliacaoVazia(resolved))
        setObservacoes('')
      }
      setLoading(false)
    }
    loadData()
  }, [id])

  const coberturaStr = useMemo(() => formatarNotaCobertura(notaECobertura(avaliacao)), [avaliacao])

  const updateResposta = useCallback((perguntaId: string, updates: Partial<RespostaAvaliacao>) => {
    setAvaliacao((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        respostas: prev.respostas.map((r) =>
          r.pergunta_id === perguntaId
            ? {
                ...r,
                ...updates,
                estado: updates.nota != null ? ('avaliada' as const) : r.estado,
              }
            : r,
        ),
      }
    })
  }, [])

  const handleSave = async () => {
    if (!avaliacao || !id) return
    setSaving(true)
    const payload = { ...avaliacao, observacoes: observacoes || null }
    const { error } = await supabase
      .from('entrevistas')
      .update({ avaliacao: payload, avaliada_em: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      toast.error('Não foi possível salvar a avaliação.')
    } else {
      toast.success('Avaliação salva.')
      navigate(-1)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <p className="text-slate-500 text-lg">Entrevista não encontrada.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <PageHeader
        title="Avaliação de Entrevista"
        subtitle={`${candidatoNome} • ${vagaTitulo} • ${rodadaNome}`}
      >
        <Badge variant="secondary" className="text-sm font-medium">
          {coberturaStr}
        </Badge>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Perguntas ({perguntas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {perguntas.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">
              Nenhuma pergunta configurada para esta rodada.
            </p>
          )}
          {perguntas
            .filter((p) => p.tipo === 'fechada')
            .map((pergunta, idx) => {
              const resposta = avaliacao?.respostas.find((r) => r.pergunta_id === pergunta.id)
              return (
                <div key={pergunta.id || idx} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-medium mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900">{pergunta.texto}</p>
                        <Badge
                          variant="outline"
                          className={
                            pergunta.tipo === 'fechada'
                              ? 'border-blue-200 bg-blue-50 text-blue-700 text-xs'
                              : 'border-amber-200 bg-amber-50 text-amber-700 text-xs'
                          }
                        >
                          {pergunta.tipo === 'fechada' ? (
                            <CheckSquare className="w-3 h-3 mr-1" />
                          ) : (
                            <MessageSquare className="w-3 h-3 mr-1" />
                          )}
                          {pergunta.tipo}
                        </Badge>
                      </div>

                      {pergunta.tipo === 'fechada' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {NOTAS_AVALIACAO.map((opcao) => {
                            const isSelected = resposta?.nota === opcao.valor
                            return (
                              <button
                                key={opcao.valor}
                                type="button"
                                onClick={() => updateResposta(pergunta.id, { nota: opcao.valor })}
                                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                  isSelected
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {opcao.rotulo}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <Textarea
                          value={resposta?.resposta_texto || ''}
                          onChange={(e) =>
                            updateResposta(pergunta.id, { resposta_texto: e.target.value })
                          }
                          placeholder="Registre a resposta do candidato..."
                          className="min-h-[80px] text-sm"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observações do recrutador</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Observações gerais sobre o candidato nesta entrevista..."
            className="min-h-[100px] text-sm"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar avaliação
        </Button>
      </div>
    </div>
  )
}
