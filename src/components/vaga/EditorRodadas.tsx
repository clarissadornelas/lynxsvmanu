import { parseEtapas, rotuloTipoRodada } from '@/lib/funnel-phases'
import type { Json } from '@/lib/supabase/types'

interface EditorRodadasProps {
  etapas: Json | null | undefined
  candidatosPorRodada?: Record<number, number>
}

export default function EditorRodadas({ etapas, candidatosPorRodada }: EditorRodadasProps) {
  const rodadas = parseEtapas(etapas)

  if (rodadas.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Esta vaga ainda não tem rodadas de entrevista configuradas.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        O nome é livre e aparece para o time. O tipo é fechado e define o roteiro padrão e o script
        do Copiloto.
      </p>
      {rodadas.map((rodada) => {
        const numCandidatos = candidatosPorRodada?.[rodada.n] ?? 0
        const temAgenda = rodada.agenda_id !== null

        return (
          <div key={rodada.n} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {rodada.n}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{rodada.nome}</p>
                  <p className="text-xs text-slate-500">
                    {rotuloTipoRodada(rodada.tipo)} · {rodada.duracao} min
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-slate-400">
                  {temAgenda ? 'agenda vinculada' : 'agenda interna'}
                </span>
                <span className="text-xs text-slate-400">
                  {numCandidatos === 0 ? 'ninguém aqui ainda' : `${numCandidatos} nesta rodada`}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
