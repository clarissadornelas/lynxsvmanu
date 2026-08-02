import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  parseEtapas,
  rotuloTipoRodada,
  TIPOS_RODADA,
  tipoRodadaValido,
  resolverPerguntas,
  lerBancoCasa,
  type EtapaVaga,
  type PerguntaEtapa,
  type TipoPergunta,
} from '@/lib/funnel-phases'
import type { Json } from '@/lib/supabase/types'
import { useActiveContext } from '@/stores/useActiveContext'
import { ChevronDown, ChevronUp, Lock, Plus, Save } from 'lucide-react'
import { StageQuestions } from '@/components/vaga/StageQuestions'

interface EditorRodadasProps {
  etapas: Json | null | undefined
  candidatosPorRodada?: Record<number, number>
  vagaId?: string
  onSalvo?: () => void
}

export default function EditorRodadas({
  etapas,
  candidatosPorRodada,
  vagaId,
  onSalvo,
}: EditorRodadasProps) {
  const { tenantId } = useActiveContext()
  const somenteLeitura = !vagaId
  const [rodadas, setRodadas] = useState<EtapaVaga[]>(() => parseEtapas(etapas))
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [bancoCasa, setBancoCasa] = useState<Record<string, PerguntaEtapa[]>>({})
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set())

  useEffect(() => {
    setRodadas(parseEtapas(etapas))
    setSujo(false)
  }, [etapas])

  useEffect(() => {
    if (!tenantId) return
    let active = true
    supabase
      .from('configuracoes_agente')
      .select('perguntas_padrao')
      .eq('tenant_id', tenantId)
      .eq('agent_type', 'copiloto')
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        if (data?.perguntas_padrao) setBancoCasa(lerBancoCasa(data.perguntas_padrao))
      })
    return () => {
      active = false
    }
  }, [tenantId])

  const alterar = (n: number, campo: 'nome' | 'tipo' | 'duracao', valor: string) => {
    setRodadas((prev) =>
      prev.map((r) => {
        if (r.n !== n) return r
        if (campo === 'duracao') {
          const num = Number(valor)
          return { ...r, duracao: Number.isFinite(num) && num >= 5 ? num : 5 }
        }
        if (campo === 'tipo') return { ...r, tipo: tipoRodadaValido(valor) }
        return { ...r, [campo]: valor }
      }),
    )
    setSujo(true)
  }

  const acrescentar = () => {
    setRodadas((prev) => {
      const proximoN = prev.length > 0 ? Math.max(...prev.map((r) => r.n)) + 1 : 1
      return [
        ...prev,
        { n: proximoN, nome: 'Nova rodada', tipo: 'rh', agenda_id: null, duracao: 60 },
      ]
    })
    setSujo(true)
  }

  const remover = (n: number) => {
    if ((candidatosPorRodada?.[n] ?? 0) > 0) return
    setRodadas((prev) => prev.filter((r) => r.n !== n).map((r, i) => ({ ...r, n: i + 1 })))
    setSujo(true)
  }

  const toggleExpand = (n: number) => {
    setExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  const acrescentarPergunta = (n: number, texto: string) => {
    const id = `vaga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setRodadas((prev) =>
      prev.map((r) => {
        if (r.n !== n) return r
        const pergunta: PerguntaEtapa = {
          id,
          texto,
          tipo: 'fechada',
          escopo: 'vaga',
        }
        return { ...r, perguntas: [...(r.perguntas ?? []), pergunta] }
      }),
    )
    setExpandidas((prev) => new Set(prev).add(n))
    setSujo(true)
  }

  const editarPergunta = (n: number, perguntaId: string, novoTexto: string, tipo: TipoPergunta) => {
    setRodadas((prev) =>
      prev.map((r) => {
        if (r.n !== n) return r
        const existing = r.perguntas ?? []
        const idx = existing.findIndex((p) => p.id === perguntaId)
        if (idx >= 0) {
          const updated = [...existing]
          updated[idx] = { ...updated[idx], texto: novoTexto, editada: true }
          return { ...r, perguntas: updated }
        }
        const pergunta: PerguntaEtapa = {
          id: perguntaId,
          texto: novoTexto,
          tipo,
          escopo: 'vaga',
          editada: true,
        }
        return { ...r, perguntas: [...existing, pergunta] }
      }),
    )
    setSujo(true)
  }

  const removerPergunta = (n: number, perguntaId: string, escopo: 'casa' | 'vaga' = 'vaga') => {
    setRodadas((prev) =>
      prev.map((r) => {
        if (r.n !== n) return r
        if (escopo === 'casa') {
          const atual = r.silenciadas ?? []
          return atual.includes(perguntaId) ? r : { ...r, silenciadas: [...atual, perguntaId] }
        }
        return {
          ...r,
          perguntas: (r.perguntas ?? []).filter((p) => p.id !== perguntaId),
        }
      }),
    )
    setSujo(true)
  }

  const restaurarPergunta = (n: number, perguntaId: string) => {
    setRodadas((prev) =>
      prev.map((r) => {
        if (r.n !== n) return r
        return {
          ...r,
          silenciadas: (r.silenciadas ?? []).filter((id) => id !== perguntaId),
        }
      }),
    )
    setSujo(true)
  }

  const salvar = async () => {
    if (!vagaId) return
    setSalvando(true)
    const { error } = await supabase
      .from('vagas')
      .update({ etapas: rodadas as unknown as Json })
      .eq('id', vagaId)
    setSalvando(false)
    if (error) {
      toast.error('Erro ao salvar rodadas: ' + error.message)
      return
    }
    toast.success('Rodadas salvas.')
    setSujo(false)
    onSalvo?.()
  }

  if (rodadas.length === 0 && somenteLeitura) {
    return (
      <p className="text-sm text-slate-400">
        Esta vaga ainda não tem rodadas de entrevista configuradas.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {!somenteLeitura && (
        <p className="text-xs text-slate-500">
          O nome é livre e aparece para o time. O tipo é fechado e define o roteiro padrão e o
          script do Copiloto.
        </p>
      )}
      {rodadas.map((rodada) => {
        const numCandidatos = candidatosPorRodada?.[rodada.n] ?? 0
        const temAgenda = rodada.agenda_id !== null
        const podeRemover = numCandidatos === 0
        const perguntasResolvidas = resolverPerguntas(
          bancoCasa[rodada.tipo] ?? [],
          rodada.perguntas ?? [],
          rodada.silenciadas ?? [],
        )
        const expandida = expandidas.has(rodada.n)
        const mostrarPerguntas = expandida || (perguntasResolvidas.length === 0 && !somenteLeitura)

        return (
          <div key={rodada.n} className="rounded-lg border border-slate-200 bg-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                  {rodada.n}
                </span>
                <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                  {somenteLeitura ? (
                    <div>
                      <p className="text-sm font-medium text-slate-600">{rodada.nome}</p>
                      <p className="text-xs text-slate-500">
                        {rotuloTipoRodada(rodada.tipo)} · {rodada.duracao} min
                      </p>
                    </div>
                  ) : (
                    <>
                      <Input
                        value={rodada.nome}
                        onChange={(e) => alterar(rodada.n, 'nome', e.target.value)}
                        className="h-8 text-sm flex-1 min-w-[120px]"
                        disabled={somenteLeitura}
                      />
                      <Select
                        value={rodada.tipo}
                        onValueChange={(val) => alterar(rodada.n, 'tipo', val)}
                        disabled={somenteLeitura}
                      >
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_RODADA.map((t) => (
                            <SelectItem key={t.valor} value={t.valor}>
                              {t.rotulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={rodada.duracao}
                        onChange={(e) => alterar(rodada.n, 'duracao', e.target.value)}
                        className="h-8 w-[74px] text-xs"
                        disabled={somenteLeitura}
                      />
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs text-slate-400">
                  {temAgenda ? 'agenda vinculada' : 'agenda interna'}
                </span>
                <span className="text-xs text-slate-400">
                  {numCandidatos === 0 ? 'ninguém aqui ainda' : `${numCandidatos} nesta rodada`}
                </span>
              </div>
            </div>

            {perguntasResolvidas.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => toggleExpand(rodada.n)}
                  className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  {expandida ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {expandida
                    ? `Esconder ${perguntasResolvidas.length} pergunta(s) desta rodada`
                    : `Ver ${perguntasResolvidas.length} pergunta(s) desta rodada`}
                </button>
              </div>
            )}

            {mostrarPerguntas && (
              <StageQuestions
                rodada={rodada}
                bancoCasa={bancoCasa[rodada.tipo] ?? []}
                somenteLeitura={somenteLeitura}
                numCandidatos={numCandidatos}
                onAddQuestion={acrescentarPergunta}
                onEditQuestion={editarPergunta}
                onRemoveQuestion={removerPergunta}
                onRestoreQuestion={restaurarPergunta}
              />
            )}

            {!somenteLeitura && (
              <div className="mt-2 flex justify-end">
                {podeRemover ? (
                  <button
                    onClick={() => remover(rodada.n)}
                    disabled={somenteLeitura}
                    className="text-xs text-red-600 hover:text-red-700 disabled:text-slate-300"
                  >
                    Remover
                  </button>
                ) : (
                  <span
                    className="flex items-center gap-1 text-xs text-slate-400"
                    title="Rodada com gente dentro não pode ser removida nem reordenada"
                  >
                    <Lock className="h-3 w-3" />
                    {numCandidatos} {numCandidatos === 1 ? 'candidato' : 'candidatos'}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
      {!somenteLeitura && (
        <>
          <button
            onClick={acrescentar}
            className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-left text-sm text-slate-600 hover:border-slate-400"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Acrescentar rodada no fim
            </span>
          </button>
          <div className="flex justify-end pt-1">
            <Button onClick={salvar} disabled={!sujo || salvando} size="sm">
              <Save className="h-4 w-4 mr-1" />
              {salvando ? 'Salvando...' : 'Salvar rodadas'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
