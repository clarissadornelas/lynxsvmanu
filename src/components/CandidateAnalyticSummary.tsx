import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { safeJsonParse } from '@/lib/safe-json'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Database, Calendar, User, FileText } from 'lucide-react'

interface CandidateAnalyticSummaryProps {
  dadosAdicionais?: string | null
  resumoEntrevista?: string | null
}

interface EntrevistaInfo {
  entrevista_id?: string
  realizada_em?: string
  realizada_por_nome?: string
  transcricao_preview?: string
}

interface RelatorioInfo {
  executive_summary?: string
  alignment?: string
  strengths?: string[]
  risks?: string[]
  recommendation?: string
  nextSteps?: string
}

export function CandidateAnalyticSummary({
  dadosAdicionais,
  resumoEntrevista,
}: CandidateAnalyticSummaryProps) {
  const [baseAtivaCount, setBaseAtivaCount] = useState<number | null>(null)

  const parsedDados: Record<string, any> = safeJsonParse(dadosAdicionais, {})
  const ultimaEntrevista: EntrevistaInfo | undefined = parsedDados?.ultima_entrevista
  const relatorio: RelatorioInfo = safeJsonParse(resumoEntrevista, {})

  useEffect(() => {
    let cancelled = false
    async function checkBaseAtiva() {
      try {
        const { count, error } = await supabase
          .from('base_ativa')
          .select('id', { count: 'exact' })
          .eq('opt_out', false)
          .not('contato_ate', 'is', null)
          .limit(0)

        if (cancelled) return
        if (error) {
          setBaseAtivaCount(null)
          return
        }
        setBaseAtivaCount(count ?? 0)
      } catch {
        if (!cancelled) setBaseAtivaCount(null)
      }
    }
    checkBaseAtiva()
    return () => {
      cancelled = true
    }
  }, [])

  const hasContent = ultimaEntrevista || relatorio.executive_summary || relatorio.alignment

  if (!hasContent) return null

  return (
    <Card className="border-slate-200">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <CardTitle className="text-lg flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-600" /> Resumo Analítico do Candidato
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {baseAtivaCount !== null && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Base Ativa: {baseAtivaCount} contato(s) ativo(s)
            </Badge>
          </div>
        )}

        {ultimaEntrevista && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 border-b pb-2">
              Última Entrevista
            </h3>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              {ultimaEntrevista.realizada_em && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {new Date(ultimaEntrevista.realizada_em).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
              {ultimaEntrevista.realizada_por_nome && (
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" />
                  {ultimaEntrevista.realizada_por_nome}
                </div>
              )}
            </div>
            {ultimaEntrevista.transcricao_preview && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-600">
                <FileText className="w-4 h-4 text-slate-400 inline mr-1.5" />
                {ultimaEntrevista.transcricao_preview}
              </div>
            )}
          </div>
        )}

        {(relatorio.executive_summary || relatorio.alignment) && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 border-b pb-2">
              Resumo Executivo
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
              {relatorio.executive_summary || relatorio.alignment}
            </p>
          </div>
        )}

        {relatorio.strengths && relatorio.strengths.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-600 border-b border-emerald-100 pb-2">
              Pontos Fortes
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
              {relatorio.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {relatorio.risks && relatorio.risks.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-600 border-b border-amber-100 pb-2">
              Pontos de Atenção
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
              {relatorio.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {relatorio.recommendation && (
          <>
            <Separator />
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Recomendação:
              </h3>
              <Badge
                variant="outline"
                className="bg-white shadow-sm border-slate-200 text-slate-800"
              >
                {relatorio.recommendation}
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
