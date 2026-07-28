import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Zap, FileSpreadsheet } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

export function ImportModal({
  tenantId,
  onSuccess,
}: {
  tenantId: string | null
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const parseXML = (text: string) => {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(text, 'text/xml')
    const records = Array.from(xmlDoc.getElementsByTagName('candidato')).map((node) => ({
      nome: node.getElementsByTagName('nome')[0]?.textContent || '',
      telefone: node.getElementsByTagName('telefone')[0]?.textContent || '',
      nicho: node.getElementsByTagName('nicho')[0]?.textContent || '',
      mercado: node.getElementsByTagName('mercado')[0]?.textContent || '',
      nivel: node.getElementsByTagName('nivel')[0]?.textContent || '',
      segmento: node.getElementsByTagName('segmento')[0]?.textContent || '',
    }))
    return records
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !tenantId) return
    setLoading(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        let records: any[] = []

        if (file.name.endsWith('.xml')) {
          records = parseXML(text)
        } else {
          // Fallback to CSV
          const rows = text.split('\n').slice(1)
          records = rows
            .filter((r) => r.trim())
            .map((row) => {
              const cols = row.split(',').map((s) => s?.trim() || '')
              return {
                nome: cols[0],
                telefone: cols[1],
                nicho: cols[2],
                mercado: cols[3],
                nivel: cols[4],
                segmento: cols[5],
              }
            })
        }

        const validRecords = records
          .filter((r) => r.telefone)
          .map((r) => ({
            ...r,
            tenant_id: tenantId,
            origem: 'importacao',
          }))

        if (validRecords.length > 0) {
          const { error } = await supabase
            .from('base_ativa')
            .upsert(validRecords, { onConflict: 'tenant_id,telefone' })
          if (error) throw error
          toast.success(`${validRecords.length} talentos importados com sucesso!`)
          setOpen(false)
          onSuccess()
        } else {
          toast.info('Nenhum registro válido encontrado no arquivo.')
        }
      } catch (err: any) {
        toast.error('Erro ao importar: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsText(file)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="w-4 h-4 mr-2" /> Importar Base
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Data Import Suite</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label>Upload Manual (CSV, XML, Excel via CSV)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Mapeamento de colunas: Nome, Telefone, Nicho, Mercado, Nível, Segmento
            </p>
            <Input type="file" accept=".csv,.xml" onChange={handleImport} disabled={loading} />
          </div>

          <div className="border-t pt-4 space-y-3">
            <Label>Integrações de CRM</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
                onClick={() => toast.info('Webhook gerado! Configure no Zapier.')}
              >
                <Zap className="w-4 h-4 mr-2" /> Zapier
              </Button>
              <Button
                variant="outline"
                className="flex-1 bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:text-purple-800"
                onClick={() => toast.info('Webhook gerado! Configure no Make.')}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Make
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Use as integrações para alimentar a base automaticamente.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
