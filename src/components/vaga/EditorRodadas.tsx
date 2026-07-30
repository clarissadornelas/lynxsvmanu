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
  type EtapaVaga,
} from '@/lib/funnel-phases'
import type { Json } from '@/lib/supabase/types'
import { Lock, Plus, Save, Trash2 } from 'lucide-react'

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
  const somenteLeitura = !vagaId
  const [rodadas, setRodadas] = useState<EtapaVaga[]>(() => parseEtapas(etapas))
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setRodadas(parseEtapas(etapas))
    setSujo(false)
  }, [etapas])

  const alterar = (n: number, campo: keyof EtapaVaga, valor: string) => {
    setRodadas((prev) => prev.map((r) => (r.n === n ? { ...r, [campo]: valor } : r)))
    setSujo(true)
  }

  const acrescentar = () => {
    setRodadas((prev) => {
      const proximoN = prev.length > 0 ? Math.max(...prev.map((r) => r.n)) + 1 : 1
      const nova: EtapaVaga = {
        n: proximoN,
        nome: 'Nova rodada',
        tipo: 'rh',
        agenda_id: null,
        duracao: 60,
      }
      return [...prev, nova]
    })
    setSujo(true)
  }

  const remover = (n: number) => {
    setRodadas((prev) => prev.filter((r) => r.n !== n).map((r, i) => ({ ...r, n: i + 1 })))
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
                        onValueChange={(val) => alterar(rodada.n, 'tipo', tipoRodadaValido(val))}
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
                        onChange={(e) =>
                          alterar(
                            rodada.n,
                            'duracao',
                            String(Math.max(5, Number(e.target.value) || 60)),
                          )
                        }
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
