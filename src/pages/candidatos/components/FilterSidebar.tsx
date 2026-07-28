import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Filter } from 'lucide-react'

interface FilterProps {
  search: string
  setSearch: (v: string) => void
  status?: string
  setStatus?: (v: string) => void
  nivel: string
  setNivel: (v: string) => void
  nicho: string
  setNicho: (v: string) => void
}

export function FilterSidebar({
  search,
  setSearch,
  status,
  setStatus,
  nivel,
  setNivel,
  nicho,
  setNicho,
}: FilterProps) {
  return (
    <div className="w-full md:w-64 space-y-6 p-4 border rounded-lg bg-card h-fit sticky top-6 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-lg text-slate-800 border-b pb-3">
        <Filter className="w-4 h-4" /> Filtros Avançados
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-slate-500">Buscar</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {status !== undefined && setStatus && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-slate-500">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="novo">Novo</SelectItem>
              <SelectItem value="em_entrevistas">Em Entrevistas</SelectItem>
              <SelectItem value="contratado">Contratado</SelectItem>
              <SelectItem value="reprovado">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-slate-500">Nível</Label>
        <Select value={nivel} onValueChange={setNivel}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Níveis</SelectItem>
            <SelectItem value="C-level">C-level</SelectItem>
            <SelectItem value="Diretoria">Diretoria</SelectItem>
            <SelectItem value="Gerência">Gerência</SelectItem>
            <SelectItem value="Especialista">Especialista</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-slate-500">Nicho / Mercado</Label>
        <Input
          placeholder="Ex: Tecnologia"
          value={nicho}
          onChange={(e) => setNicho(e.target.value)}
        />
      </div>
    </div>
  )
}
