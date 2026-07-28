import { useMemo, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Copy } from 'lucide-react'
import { formatCellValue } from './utils'

interface DuplicateDetectorProps {
  columns: string[]
  data: Record<string, unknown>[]
  onFilter: (column: string | null, value: string | null) => void
  activeColumn: string | null
  activeValue: string | null
}

export function DuplicateDetector({
  columns,
  data,
  onFilter,
  activeColumn,
  activeValue,
}: DuplicateDetectorProps) {
  const [selectedColumn, setSelectedColumn] = useState<string>('')

  const duplicates = useMemo(() => {
    if (!selectedColumn || data.length === 0) return []
    const counts = new Map<string, number>()
    data.forEach((row) => {
      const val = formatCellValue(row[selectedColumn])
      if (val === '—') return
      counts.set(val, (counts.get(val) || 0) + 1)
    })
    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
  }, [selectedColumn, data])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select
          value={selectedColumn}
          onValueChange={(v) => {
            setSelectedColumn(v)
            onFilter(null, null)
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecionar coluna..." />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col} value={col} className="text-xs">
                {col}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeColumn && activeValue && (
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="text-xs">
            Filtro: {activeColumn} = {activeValue}
          </Badge>
          <button
            onClick={() => onFilter(null, null)}
            className="text-red-500 hover:text-red-700 underline"
          >
            limpar
          </button>
        </div>
      )}

      {duplicates.length > 0 && (
        <ScrollArea className="h-48 rounded-md border border-slate-200">
          <div className="p-1">
            {duplicates.map(([value, count]) => {
              const isActive = activeColumn === selectedColumn && activeValue === value
              return (
                <button
                  key={value}
                  onClick={() =>
                    onFilter(isActive ? null : selectedColumn, isActive ? null : value)
                  }
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1 text-xs rounded transition-colors ${
                    isActive ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="truncate flex-1 text-left font-mono">{value}</span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    <Copy className="w-3 h-3 mr-1" />
                    {count}
                  </Badge>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      )}

      {selectedColumn && duplicates.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">
          Nenhum registro duplicado encontrado nesta coluna.
        </p>
      )}
    </div>
  )
}
