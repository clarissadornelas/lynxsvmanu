import {
  resolverPerguntas,
  type EtapaVaga,
  type PerguntaEtapa,
  type TipoPergunta,
} from '@/lib/funnel-phases'

interface StageQuestionsProps {
  rodada: EtapaVaga
  bancoCasa: PerguntaEtapa[]
  somenteLeitura: boolean
  numCandidatos: number
  onAddQuestion: (n: number, texto: string) => void
  onEditQuestion: (n: number, perguntaId: string, novoTexto: string, tipo: TipoPergunta) => void
  onRemoveQuestion: (n: number, perguntaId: string, scope: 'casa' | 'vaga') => void
  onRestoreQuestion: (n: number, perguntaId: string) => void
}

export function StageQuestions({
  rodada,
  bancoCasa,
  somenteLeitura,
  numCandidatos,
  onAddQuestion,
  onEditQuestion,
  onRemoveQuestion,
  onRestoreQuestion,
}: StageQuestionsProps) {
  const silenciadas = rodada.silenciadas ?? []
  const perguntas = resolverPerguntas(bancoCasa, rodada.perguntas ?? [], silenciadas)
  const mudas = bancoCasa.filter((p) => silenciadas.includes(p.id))

  const handleAdd = () => {
    const texto = window.prompt('Nova pergunta desta vaga (fechada, nota 1 a 4):')
    if (!texto || texto.trim().length === 0) return
    onAddQuestion(rodada.n, texto.trim())
  }

  const handleEdit = (p: PerguntaEtapa) => {
    const texto = window.prompt(
      'Editar pergunta (vale para os próximos candidatos desta vaga):',
      p.texto,
    )
    if (!texto || texto.trim().length === 0 || texto.trim() === p.texto) return
    onEditQuestion(rodada.n, p.id, texto.trim(), p.tipo)
  }

  const handleRemove = (p: PerguntaEtapa) => {
    const scope = p.escopo === 'casa' ? 'casa' : 'vaga'
    onRemoveQuestion(rodada.n, p.id, scope)
  }

  return (
    <div className="space-y-2">
      {numCandidatos > 0 && !somenteLeitura && (
        <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
          {numCandidatos === 1
            ? '1 candidato já passou por esta rodada e guardam no histórico as perguntas da época. Mudanças aqui valem para os próximos.'
            : `${numCandidatos} candidatos já passaram por esta rodada e guardam no histórico as perguntas da época. Mudanças aqui valem para os próximos.`}
        </p>
      )}

      {perguntas.map((p) => {
        const isVaga = p.escopo === 'vaga' || p.escopo === 'candidato'
        const isEditada = p.editada === true && !isVaga
        const originLabel = isVaga ? 'desta vaga' : isEditada ? 'editada' : 'herdada da casa'
        const originClass = isVaga
          ? 'bg-blue-50 text-blue-700'
          : isEditada
            ? 'bg-amber-50 text-amber-700'
            : 'bg-slate-100 text-slate-500'
        const typeLabel = p.tipo === 'fechada' ? 'fechada, nota 1 a 4' : 'aberta, só texto'

        return (
          <div
            key={p.id}
            className="flex items-start justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm text-slate-700">{p.texto}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${originClass}`}>
                  {originLabel}
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  {typeLabel}
                </span>
              </div>
            </div>
            {!somenteLeitura && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleEdit(p)}
                  className="text-xs text-slate-600 hover:text-slate-800"
                >
                  editar
                </button>
                <button
                  onClick={() => handleRemove(p)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  {p.escopo === 'casa' ? 'não usar' : 'remover'}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {mudas.length > 0 && (
        <div className="space-y-1 rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-medium text-slate-500">
            {mudas.length === 1
              ? '1 pergunta da casa desligada nesta vaga'
              : `${mudas.length} perguntas da casa desligadas nesta vaga`}
          </p>
          {mudas.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-400 line-through">{p.texto}</p>
              {!somenteLeitura && (
                <button
                  onClick={() => onRestoreQuestion(rodada.n, p.id)}
                  className="text-xs text-blue-600 hover:text-blue-700 shrink-0"
                >
                  usar de novo
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!somenteLeitura && (
        <button
          onClick={handleAdd}
          className="w-full rounded border border-dashed border-slate-300 px-3 py-2 text-left text-sm text-slate-600 hover:border-slate-400"
        >
          + Nova pergunta desta vaga
        </button>
      )}
    </div>
  )
}
