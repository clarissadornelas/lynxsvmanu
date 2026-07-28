import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Building2, Plus, Power, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

function getUserCountLabel(count: number): string {
  return count === 1 ? '1 usuário' : `${count} usuário(s)`
}

interface Tenant {
  id: string
  nome: string
  slug: string
  ativo: boolean
}

interface TenantSectionProps {
  tenants: Tenant[]
  userCounts: Record<string, number>
  selectedTenantId: string | null
  activeTenantId: string | null
  onSelect: (id: string) => void
  onToggleActive: (id: string, current: boolean) => void
  onSetActive: (id: string) => void
  onCreate: (nome: string, slug: string) => void
}

export function TenantSection({
  tenants,
  userCounts,
  selectedTenantId,
  activeTenantId,
  onSelect,
  onToggleActive,
  onSetActive,
  onCreate,
}: TenantSectionProps) {
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')

  const handleCreate = () => {
    if (!nome.trim() || !slug.trim()) return
    onCreate(nome.trim(), slug.trim())
    setNome('')
    setSlug('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-600" />
          Tenants
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {tenants.map((t) => (
            <div
              key={t.id}
              className={cn(
                'flex items-center justify-between rounded-lg border p-3 transition-colors cursor-pointer',
                selectedTenantId === t.id
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-slate-200 hover:bg-slate-50',
              )}
              onClick={() => onSelect(t.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">{t.nome}</span>
                  <Badge variant={t.ativo ? 'default' : 'secondary'} className="text-xs">
                    {t.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {activeTenantId === t.id && (
                    <Badge variant="outline" className="text-xs text-indigo-600 border-indigo-300">
                      Atual
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">
                  slug: {t.slug} · {getUserCountLabel(userCounts[t.id] || 0)}
                </p>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        disabled={!t.ativo}
                        onClick={() => onSetActive(t.id)}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Usar este tenant</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => onToggleActive(t.id, t.ativo)}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ativar/Desativar</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label className="text-xs font-semibold text-slate-500">Novo Tenant</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-8"
            />
            <Input
              placeholder="Slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="h-8"
            />
            <Button size="sm" onClick={handleCreate} disabled={!nome.trim() || !slug.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
