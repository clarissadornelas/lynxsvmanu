import { useState, useEffect } from 'react'
import { useActiveContext } from '@/stores/useActiveContext'
import {
  fetchReportData,
  fetchVagasForFilter,
  type VagaOption,
  type ReportRawData,
} from '@/services/relatorios'
import { computeReportMetrics } from '@/lib/report-utils'
import { ReportFilters } from '@/components/relatorios/ReportFilters'
import { ReportKpis } from '@/components/relatorios/ReportKpis'
import { FunnelChart } from '@/components/relatorios/FunnelChart'
import { BottleneckChart } from '@/components/relatorios/BottleneckChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, BarChart3, TrendingDown } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'

export default function Relatorios() {
  const { tenantId } = useActiveContext()
  const [vagas, setVagas] = useState<VagaOption[]>([])
  const [selectedVaga, setSelectedVaga] = useState<string | null>(null)
  const [daysWindow, setDaysWindow] = useState(90)
  const [rawData, setRawData] = useState<ReportRawData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    fetchVagasForFilter(tenantId).then(setVagas)
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    fetchReportData(tenantId, selectedVaga, daysWindow)
      .then((data) => {
        setRawData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tenantId, selectedVaga, daysWindow])

  const metrics = rawData
    ? computeReportMetrics(rawData.eventos, rawData.candidatos, daysWindow)
    : null

  if (!tenantId) {
    return (
      <div className="p-8 text-center text-muted-foreground">Selecione um tenant em Contas</div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const bottleneckPhase = metrics?.bottleneck.find((b) => b.isBottleneck) || null

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Relatórios de Eficiência"
        subtitle="Mini BI para análise do funil de recrutamento em tempo real."
      />

      <ReportFilters
        vagas={vagas}
        selectedVaga={selectedVaga}
        onVagaChange={setSelectedVaga}
        daysWindow={daysWindow}
        onDaysWindowChange={setDaysWindow}
      />

      {!metrics || !metrics.hasData ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="max-w-md mx-auto">
              Ainda não há eventos suficientes para gerar indicadores. Os números aparecem conforme
              os candidatos avançam no funil.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ReportKpis kpis={metrics.kpis} />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent>
              <FunnelChart data={metrics.funnel} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Análise de Gargalo</CardTitle>
            </CardHeader>
            <CardContent>
              <BottleneckChart data={metrics.bottleneck} />
              {bottleneckPhase && bottleneckPhase.avgDays !== null && (
                <Alert className="mt-4 border-red-200 bg-red-50">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-red-700">
                    Gargalo: candidatos ficam {bottleneckPhase.avgDays.toFixed(1)} dias parados em{' '}
                    {bottleneckPhase.label} antes de avançar.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
