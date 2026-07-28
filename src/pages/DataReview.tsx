import { TableExplorer } from '@/components/table-explorer'
import { PageHeader } from '@/components/PageHeader'

export default function DataReview() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Inspeção"
        subtitle="Explorador somente leitura para auditoria completa dos dados do banco. Visualize colunas técnicas, identifique duplicados, copie IDs e exporte relatórios para análise offline."
      />
      <TableExplorer />
    </div>
  )
}
