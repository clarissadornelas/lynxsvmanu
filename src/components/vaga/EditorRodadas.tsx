import { parseEtapas, rotuloTipoRodada } from '@/lib/funnel-phases'
import type { Json } from '@/lib/supabase/types'

interface EditorRodadasProps {
  etapas: Json | null | undefined
  candidatosPorRodada?: Record<number, number>
}

export function EditorRodadas({ etapas, candidatosPorRodada }: EditorRodadasProps) {
  const rodadas = parseEtapas(etapas)

  if (rodadas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta vaga ainda não tem rodadas de entrevista configuradas.
      </p>
    )
  }

  return (
    <div className="space-y-3">
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
                  <p className="text-xs text-muted-foreground">
                    {rotuloTipoRodada(rodada.tipo)} · {rodada.duracao} min
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    temAgenda
                      ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
                      : 'inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600'
                  }
                >
                  {temAgenda ? 'Agenda vinculada' : 'Sem agenda'}
                </span>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {numCandidatos} {numCandidatos === 1 ? 'candidato' : 'candidatos'}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
