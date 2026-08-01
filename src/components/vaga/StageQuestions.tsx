import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Check, X, AlertTriangle } from 'lucide-react'
import {
  resolverPerguntas,
  type PerguntaEtapa,
  type EtapaVaga,
  type TipoPergunta,
} from '@/lib/funnel-phases'

interface StageQuestionsProps {
  rodada: EtapaVaga
  bancoCasa: PerguntaEtapa[]
  somenteLeitura: boolean
  numCandidatos: number
  onAddQuestion: (rodadaN: number, texto: string) => void
  onEditQuestion: (
    rodadaN: number,
    perguntaId: string,
    novoTexto: string,
    tipo: TipoPergunta,
  ) => void
  onRemoveQuestion: (rodadaN: number, perguntaId: string) => void
}

function origemBadge(p: PerguntaEtapa): { label: string; cls: string } {
  if (p.escopo === 'vaga' || p.escopo === 'candidato')
    return { label: 'desta vaga', cls: 'bg-blue-50 text-blue-700' }
  if (p.editada) return { label: 'editada', cls: 'bg-amber-50 text-amber-700' }
  return { label: 'herdada da casa', cls: 'bg-slate-100 text-slate-500' }
}

export function StageQuestions({
  rodada,
  bancoCasa,
  somenteLeitura,
  numCandidatos,
  onAddQuestion,
  onEditQuestion,
  onRemoveQuestion,
}: StageQuestionsProps) {
  const [adding, setAdding] = useState(false)
  const [novoTexto, setNovoTexto] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEdicao, setTextoEdicao] = useState('')

  const perguntas = resolverPerguntas(bancoCasa, rodada.perguntas ?? [])

  const confirmarAdd = () => {
    if (!novoTexto.trim()) return
    onAddQuestion(rodada.n, novoTexto.trim())
    setNovoTexto('')
    setAdding(false)
  }

  const iniciarEdicao = (p: PerguntaEtapa) => {
    setEditandoId(p.id)
    setTextoEdicao(p.texto)
  }

  const confirmarEdicao = () => {
    if (!editandoId || !textoEdicao.trim()) return
    const p = perguntas.find((q) => q.id === editandoId)
    if (p) onEditQuestion(rodada.n, p.id, textoEdicao.trim(), p.tipo)
    setTextoEdicao('')
    setEditandoId(null)
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setTextoEdicao('')
  }

  const cancelarAdd = () => {
    setAdding(false)
    setNovoTexto('')
  }

  return (
    <div className="mt-2 space-y-2">
      {numCandidatos > 0 && !somenteLeitura && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-slate-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            Quem já foi entrevistado guarda no histórico as perguntas da época. Mudanças aqui valem
            para os próximos candidatos.
          </span>
        </div>
      )}

      {perguntas.map((p) => {
        const origem = origemBadge(p)
        const isEditing = editandoId === p.id
        return (
          <div key={p.id} className="rounded-md bg-white/60 p-2.5">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={textoEdicao}
                  onChange={(e) => setTextoEdicao(e.target.value)}
                  className="h-7 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmarEdicao()
                    if (e.key === 'Escape') cancelarEdicao()
                  }}
                />
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={confirmarEdicao}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelarEdicao}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-700">{p.texto}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${origem.cls}`}>
                    {origem.label}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {p.tipo === 'fechada' ? 'fechada, nota 1 a 4' : 'aberta, só texto'}
                  </span>
                  {!somenteLeitura && (
                    <button
                      onClick={() => iniciarEdicao(p)}
                      className="ml-auto flex items-center gap-1 text-[10px] font-medium text-slate-600 hover:text-slate-800"
                    >
                      <Pencil className="h-3 w-3" />
                      editar
                    </button>
                  )}
                  {!somenteLeitura && p.escopo !== 'casa' && (
                    <button
                      onClick={() => onRemoveQuestion(rodada.n, p.id)}
                      className="flex items-center gap-1 text-[10px] font-medium text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                      remover
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}

      {!somenteLeitura && (
        <div>
          {adding ? (
            <div className="flex items-center gap-2">
              <Input
                value={novoTexto}
                onChange={(e) => setNovoTexto(e.target.value)}
                placeholder="Texto da pergunta..."
                className="h-7 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmarAdd()
                  if (e.key === 'Escape') cancelarAdd()
                }}
              />
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={confirmarAdd}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelarAdd}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova pergunta desta vaga
            </button>
          )}
        </div>
      )}
    </div>
  )
}
