import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Download, ClipboardPaste, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { parseBulkDates, type ParseResult } from '@/lib/holiday-utils'

interface Holiday {
  id: string
  data: string
  nome: string
}

interface Props {
  tenantId: string
}

export function HolidayManager({ tenantId }: Props) {
  const { toast } = useToast()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [fetching, setFetching] = useState(false)

  const loadHolidays = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('feriados_customizados')
      .select('id, data, nome')
      .eq('tenant_id', tenantId)
      .order('data')
    setHolidays((data || []) as Holiday[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    loadHolidays()
  }, [loadHolidays])

  const addManual = async () => {
    if (!newDate || !newName.trim()) return
    const { error } = await supabase
      .from('feriados_customizados')
      .insert({ tenant_id: tenantId, data: newDate, nome: newName.trim() })
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      setNewDate('')
      setNewName('')
      await loadHolidays()
      toast({ title: 'Feriado adicionado' })
    }
  }

  const removeHoliday = async (id: string) => {
    const { error } = await supabase.from('feriados_customizados').delete().eq('id', id)
    if (!error) {
      setHolidays(holidays.filter((h) => h.id !== id))
    }
  }

  const fetchNational = async () => {
    setFetching(true)
    try {
      const { data, error } = await supabase.functions.invoke('fetch-feriados-nacionais', {
        body: { year: new Date().getFullYear() },
      })
      if (error) throw error
      const national: { date: string; name: string }[] = data.holidays || []
      const existingDates = new Set(holidays.map((h) => h.data))
      const toInsert = national
        .filter((h) => !existingDates.has(h.date))
        .map((h) => ({ tenant_id: tenantId, data: h.date, nome: h.name }))
      if (toInsert.length > 0) {
        await supabase.from('feriados_customizados').insert(toInsert)
        await loadHolidays()
        toast({ title: `${toInsert.length} feriados nacionais importados` })
      } else {
        toast({ title: 'Todos os feriados nacionais já estão cadastrados' })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao buscar feriados',
        description: err?.message || 'API indisponível',
        variant: 'destructive',
      })
    }
    setFetching(false)
  }

  const parseBulk = () => setPreview(parseBulkDates(bulkText))

  const saveBulk = async () => {
    if (!preview || preview.valid.length === 0) return
    const existingDates = new Set(holidays.map((h) => h.data))
    const toInsert = preview.valid
      .filter((p) => !existingDates.has(p.date))
      .map((p) => ({ tenant_id: tenantId, data: p.date, nome: p.name }))
    if (toInsert.length > 0) {
      await supabase.from('feriados_customizados').insert(toInsert)
      await loadHolidays()
    }
    setBulkText('')
    setPreview(null)
    toast({ title: `${toInsert.length} feriados importados` })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feriados e Recessos</CardTitle>
        <CardDescription>Gerencie datas bloqueadas para agendamento.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            Esta lista traz apenas feriados NACIONAIS. Feriados municipais e estaduais (ex:
            aniversário de São Paulo) precisam ser adicionados manualmente.
          </p>
        </div>

        <Button onClick={fetchNational} disabled={fetching} variant="outline" className="w-full">
          <Download className="w-4 h-4 mr-2" />
          {fetching ? 'Buscando...' : 'Buscar feriados nacionais'}
        </Button>

        <div className="flex items-end gap-2">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Data</Label>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="space-y-1 flex-[2]">
            <Label className="text-xs">Nome</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Aniversário de SP"
              className="h-8"
            />
          </div>
          <Button size="sm" onClick={addManual} disabled={!newDate || !newName.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Importação em lote</Label>
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={
              '25/01/2026 Aniversário de São Paulo\n09/07/2026 Revolução Constitucionalista\n25/01 Aniversário de SP'
            }
            rows={4}
            className="text-sm"
          />
          <Button onClick={parseBulk} variant="outline" size="sm" disabled={!bulkText.trim()}>
            <ClipboardPaste className="w-4 h-4 mr-1" /> Analisar
          </Button>
        </div>

        {preview && (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold">Reconheci {preview.valid.length} data(s):</p>
            <div className="flex flex-wrap gap-1">
              {preview.valid.map((v, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {new Date(v.date + 'T00:00:00').toLocaleDateString('pt-BR')} — {v.name}
                </Badge>
              ))}
            </div>
            {preview.invalid.length > 0 && (
              <>
                <p className="text-xs font-semibold text-red-600">Não entendi estas linhas:</p>
                <ul className="text-xs text-red-500 list-disc list-inside">
                  {preview.invalid.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </>
            )}
            <Button onClick={saveBulk} size="sm" disabled={preview.valid.length === 0}>
              Confirmar e salvar
            </Button>
          </div>
        )}

        <div className="space-y-1">
          {loading && <p className="text-xs text-slate-400">Carregando...</p>}
          {holidays.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-md border px-2 py-1.5"
            >
              <span className="text-sm">
                <span className="font-medium">
                  {new Date(h.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
                <span className="text-slate-400 ml-2">{h.nome}</span>
              </span>
              <button
                onClick={() => removeHoliday(h.id)}
                className="text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {!loading && holidays.length === 0 && (
            <p className="text-xs text-slate-400">Nenhum feriado cadastrado.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
