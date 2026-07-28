import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { NewCandidateModal } from './NewCandidateModal'

export function CandidatosTab() {
  const [candidatos, setCandidatos] = useState<any[]>([])
  const [open, setOpen] = useState(false)

  const loadCandidatos = async () => {
    const { data } = await supabase
      .from('candidatos')
      .select('*, vagas(titulo, empresa)')
      .eq('status', 'em_teste')
      .order('contratado_em', { ascending: false })
    if (data) setCandidatos(data)
  }

  useEffect(() => {
    loadCandidatos()
  }, [])

  return (
    <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Candidatos em Onboarding</h3>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Novo Candidato
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Início</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidatos.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.nome}</TableCell>
              <TableCell>{c.cargo || c.vagas?.titulo || '-'}</TableCell>
              <TableCell>{c.empresa || c.vagas?.empresa || '-'}</TableCell>
              <TableCell>
                {c.contratado_em ? format(new Date(c.contratado_em), 'dd/MM/yyyy') : '-'}
              </TableCell>
            </TableRow>
          ))}
          {candidatos.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                Nenhum candidato em período de teste.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <NewCandidateModal open={open} onOpenChange={setOpen} onSuccess={loadCandidatos} />
    </div>
  )
}
