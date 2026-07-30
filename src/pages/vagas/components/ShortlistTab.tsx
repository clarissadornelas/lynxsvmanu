import { useState, useEffect, useMemo } from 'react'
import type { Candidate } from '@/stores/useRecruitmentStore'
import useRecruitmentStore from '@/stores/useRecruitmentStore'
import { supabase } from '@/lib/supabase/client'
import { parseAvaliacao, notaECobertura } from '@/lib/funnel-phases'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { GripVertical, Loader2, Save, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/avatar-utils'

interface EvalSummary {
  media: number | null
  respondidas: number
  fechadas: number
}

function aggregateEvals(
  interviews: { avaliacao: unknown; avaliada_em: string | null }[],
): EvalSummary {
  const evaluated = interviews.filter((iv) => iv.avaliada_em)
  if (!evaluated.length) return { media: null, respondidas: 0, fechadas: 0 }
  let sumMedia = 0,
    countMedia = 0,
    totalResp = 0,
    totalFech = 0
  for (const iv of evaluated) {
    const cob = notaECobertura(parseAvaliacao(iv.avaliacao))
    if (cob.media !== null) {
      sumMedia += cob.media
      countMedia++
    }
    totalResp += cob.respondidas
    totalFech += cob.fechadas
  }
  return {
    media: countMedia ? sumMedia / countMedia : null,
    respondidas: totalResp,
    fechadas: totalFech,
  }
}

export default function ShortlistTab({
  candidates,
  jobId,
}: {
  candidates: Candidate[]
  jobId: string
}) {
  const [loading, setLoading] = useState(true)
  const [evals, setEvals] = useState<Record<string, EvalSummary>>({})
  const [ordered, setOrdered] = useState<Candidate[]>([])
  const [sujo, setSujo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const { reload } = useRecruitmentStore()

  const finalistas = useMemo(
    () =>
      candidates
        .filter((c) => c.shortlistOrdem !== null)
        .sort((a, b) => (a.shortlistOrdem ?? 0) - (b.shortlistOrdem ?? 0)),
    [candidates],
  )

  useEffect(() => {
    setOrdered(finalistas)
    setSujo(false)
  }, [finalistas])

  useEffect(() => {
    if (!finalistas.length) {
      setLoading(false)
      return
    }
    const ids = finalistas.map((c) => c.id)
    supabase
      .from('entrevistas')
      .select('id, candidato_id, avaliacao, avaliada_em')
      .in('candidato_id', ids)
      .then(({ data, error }) => {
        if (error) {
          toast.error('Erro ao carregar avaliações: ' + error.message)
          setLoading(false)
          return
        }
        const map: Record<string, EvalSummary> = {}
        for (const c of finalistas) {
          map[c.id] = aggregateEvals((data || []).filter((iv: any) => iv.candidato_id === c.id))
        }
        setEvals(map)
        setLoading(false)
      })
  }, [finalistas])

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const next = [...ordered]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(index, 0, moved)
    setOrdered(next)
    setSujo(true)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const salvar = async () => {
    setSaving(true)
    try {
      for (let i = 0; i < ordered.length; i++) {
        const { error } = await supabase
          .from('candidatos')
          .update({ shortlist_ordem: i + 1 })
          .eq('id', ordered[i].id)
        if (error) throw error
      }
      toast.success('Ordem salva com sucesso.')
      setSujo(false)
      await reload()
    } catch (err: any) {
      toast.error('Erro ao salvar ordem: ' + (err?.message || 'erro desconhecido'))
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    )
  }

  if (!ordered.length) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center text-slate-500">
        <Trophy className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p>Nenhum finalista ainda. Um candidato entra na shortlist quando recebe uma ordem.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Shortlist ({ordered.length} finalistas)
        </h2>
        <Button
          onClick={salvar}
          disabled={!sujo || saving}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar ordem
        </Button>
      </div>
      <div className="space-y-2">
        {ordered.map((c, i) => {
          const ev = evals[c.id]
          const media = ev?.media ?? null
          const resp = ev?.respondidas ?? 0
          const fech = ev?.fechadas ?? 0
          const lowCob = fech > 0 && resp / fech < 0.6
          const isDragging = dragIndex === i
          const isDragOver = dragOverIndex === i && dragIndex !== null && dragIndex !== i
          return (
            <Card
              key={c.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverIndex(i)
              }}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => {
                setDragIndex(null)
                setDragOverIndex(null)
              }}
              className={cn(
                'cursor-grab active:cursor-grabbing transition-all',
                isDragging && 'opacity-50 border-dashed border-slate-300 bg-slate-50',
                isDragOver && 'border-dashed border-blue-400 bg-blue-50',
                !isDragging && !isDragOver && 'border-slate-200',
              )}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-sm shrink-0">
                  {i + 1}
                </span>
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage src={c.avatarUrl || undefined} alt={c.name} />
                  <AvatarFallback className="text-xs">{getInitials(c.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate text-sm">{c.name}</p>
                  <p className="text-xs text-slate-500 truncate">{c.role}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">
                    {media !== null
                      ? media.toLocaleString('pt-BR', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 1,
                        })
                      : '—'}
                  </Badge>
                  <span className={cn('text-xs', lowCob ? 'text-amber-700' : 'text-slate-500')}>
                    {resp} de {fech}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
