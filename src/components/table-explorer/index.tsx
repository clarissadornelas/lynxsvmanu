import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2,
  Search,
  Download,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DB_TABLES,
  getColumns,
  formatCellValue,
  exportToCsv,
  sortData,
  searchFilter,
} from './utils'
import { DuplicateDetector } from './duplicate-detector'

const PAGE_SIZE = 1000
const MAX_ROWS = 50000

type SortState = { column: string; direction: 'asc' | 'desc' } | null

interface FetchAllResult {
  rows: Record<string, unknown>[]
  total: number
  truncado: boolean
  error: string | null
}

async function fetchAllRows(table: string): Promise<FetchAllResult> {
  const allRows: Record<string, unknown>[] = []
  let total = 0
  let truncado = false

  let from = 0
  while (from < MAX_ROWS) {
    const {
      data: batch,
      error,
      count,
    } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      return { rows: allRows, total, truncado, error: error.message }
    }

    if (count !== null) {
      total = count
    }

    const batchRows = (batch as Record<string, unknown>[]) || []
    allRows.push(...batchRows)

    if (allRows.length >= MAX_ROWS) {
      truncado = true
      break
    }

    if (batchRows.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  if (total > allRows.length && allRows.length >= MAX_ROWS) {
    truncado = true
  }

  return { rows: allRows, total, truncado, error: null }
}

export function TableExplorer() {
  const [tableName, setTableName] = useState('')
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState>(null)
  const [dupColumn, setDupColumn] = useState<string | null>(null)
  const [dupValue, setDupValue] = useState<string | null>(null)
  const [exportingJson, setExportingJson] = useState(false)
  const [totalRows, setTotalRows] = useState<number | null>(null)
  const [truncado, setTruncado] = useState(false)

  const fetchData = useCallback(async (table: string) => {
    if (!table) return
    setLoading(true)
    setData([])
    setTotalRows(null)
    setTruncado(false)
    const result = await fetchAllRows(table)
    if (result.error) {
      toast.error(`Erro ao carregar: ${result.error}`)
    }
    setData(result.rows)
    setTotalRows(result.total)
    setTruncado(result.truncado)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (tableName) fetchData(tableName)
  }, [tableName, fetchData])

  const columns = useMemo(() => getColumns(data), [data])

  const filteredData = useMemo(() => {
    let result = searchFilter(data, search)
    if (dupColumn && dupValue) {
      result = result.filter((row) => formatCellValue(row[dupColumn]) === dupValue)
    }
    if (sort) {
      result = sortData(result, sort.column, sort.direction)
    }
    return result
  }, [data, search, dupColumn, dupValue, sort])

  const handleSort = (col: string) => {
    setSort((prev) => {
      if (!prev || prev.column !== col) return { column: col, direction: 'asc' }
      if (prev.direction === 'asc') return { column: col, direction: 'desc' }
      return null
    })
  }

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id)
      toast.success('ID copiado!')
    } catch {
      toast.error('Falha ao copiar')
    }
  }

  const handleExport = () => {
    if (filteredData.length === 0) return
    exportToCsv(filteredData, columns, `${tableName}_export`)
    toast.success('CSV exportado!')
  }

  const handleExportJson = async () => {
    setExportingJson(true)
    try {
      const result: Record<string, unknown> = {}
      for (const table of DB_TABLES) {
        const fetchResult = await fetchAllRows(table.name)
        if (fetchResult.error) {
          result[table.name] = { rows: fetchResult.rows, _erro: fetchResult.error }
        } else if (fetchResult.truncado) {
          result[table.name] = {
            rows: fetchResult.rows,
            _truncado: true,
            _total: fetchResult.total,
          }
        } else {
          result[table.name] = fetchResult.rows
        }
      }
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `lynxs-inspecao-${dateStr}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('JSON exportado!')
    } catch {
      toast.error('Erro ao exportar JSON')
    }
    setExportingJson(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <Select value={tableName} onValueChange={setTableName}>
            <SelectTrigger className="w-full sm:w-72 h-9">
              <SelectValue placeholder="Selecionar tabela..." />
            </SelectTrigger>
            <SelectContent>
              {DB_TABLES.map((t) => (
                <SelectItem key={t.name} value={t.name}>
                  {t.label} ({t.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar em todas as colunas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              disabled={!tableName}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredData.length === 0}
            className="gap-1.5"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            disabled={exportingJson}
            className="gap-1.5"
          >
            {exportingJson ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exportar tudo (JSON)
          </Button>
        </div>
      </div>

      {tableName && (
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {filteredData.length} de {data.length} linhas
            {totalRows !== null && data.length < totalRows && (
              <span className="ml-1 text-slate-400">(tabela tem {totalRows})</span>
            )}
          </Badge>
          {truncado && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertTriangle className="w-3 h-3" />
              Teto de 50000 registros atingido, tabela incompleta
            </Badge>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {tableName && columns.length > 0 && (
          <Card className="lg:w-72 shrink-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Detector de Duplicados</CardTitle>
            </CardHeader>
            <CardContent>
              <DuplicateDetector
                columns={columns}
                data={data}
                onFilter={(col, val) => {
                  setDupColumn(col)
                  setDupValue(val)
                }}
                activeColumn={dupColumn}
                activeValue={dupValue}
              />
            </CardContent>
          </Card>
        )}

        <div className="flex-1 min-w-0 overflow-auto rounded-lg border border-slate-200 bg-white">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : !tableName ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              Selecione uma tabela para visualizar os dados.
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              Nenhum registro encontrado.
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-500 w-8">
                    #
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="border-b border-slate-200 px-3 py-1.5 text-left font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                    >
                      <div className="flex items-center gap-1">
                        {col}
                        {sort?.column === col ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-indigo-600" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-indigo-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-300" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => (
                  <tr
                    key={(row.id as string) || idx}
                    className="hover:bg-indigo-50/40 transition-colors group"
                  >
                    <td className="border-b border-slate-100 px-2 py-0.5 text-slate-300 text-center tabular-nums">
                      {idx + 1}
                    </td>
                    {columns.map((col) => {
                      const raw = row[col]
                      const isId = col === 'id'
                      const display = formatCellValue(raw)
                      const isNull = raw === null || raw === undefined || raw === ''
                      return (
                        <td
                          key={col}
                          title={isNull ? 'null' : display}
                          className={`border-b border-slate-100 px-3 py-0.5 max-w-[280px] truncate align-middle ${
                            isNull ? 'text-slate-300' : 'text-slate-700'
                          } ${isId ? 'cursor-pointer hover:text-indigo-600 hover:underline font-mono' : ''}`}
                          onClick={isId && !isNull ? () => handleCopyId(display) : undefined}
                        >
                          {isNull ? '—' : display}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
