import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Users, Plus, Power, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Usuario {
  id: string
  nome: string
  whatsapp: string | null
  email: string | null
  ativo: boolean
}

interface UserSectionProps {
  users: Usuario[]
  selectedTenantName: string | null
  selectedTenantId: string | null
  activeUsuarioId: string | null
  activeTenantId: string | null
  onToggleActive: (id: string, current: boolean) => void
  onSetActive: (tenantId: string, usuarioId: string) => void
  onCreate: (nome: string, whatsapp: string, email: string) => void
}

export function UserSection({
  users,
  selectedTenantName,
  selectedTenantId,
  activeUsuarioId,
  activeTenantId,
  onToggleActive,
  onSetActive,
  onCreate,
}: UserSectionProps) {
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')

  const handleCreate = () => {
    if (!nome.trim()) return
    onCreate(nome.trim(), whatsapp.trim(), email.trim())
    setNome('')
    setWhatsapp('')
    setEmail('')
  }

  if (!selectedTenantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 text-center py-8">
            Selecione um tenant à esquerda para criar usuários.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Usuários{selectedTenantName && ` · ${selectedTenantName}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {users.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Nenhum usuário cadastrado.</p>
          )}
          {users.map((u) => (
            <div
              key={u.id}
              className={cn(
                'flex items-center justify-between rounded-lg border p-3 hover:bg-slate-50 transition-colors',
                activeTenantId && activeUsuarioId === u.id
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-slate-200',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">{u.nome}</span>
                  <Badge variant={u.ativo ? 'default' : 'secondary'} className="text-xs">
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {activeUsuarioId === u.id && (
                    <Badge variant="outline" className="text-xs text-indigo-600 border-indigo-300">
                      Atual
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">
                  {u.whatsapp || '—'} · {u.email || '—'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  disabled={!u.ativo}
                  onClick={() => onSetActive(selectedTenantId, u.id)}
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => onToggleActive(u.id, u.ativo)}
                >
                  <Power className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label className="text-xs font-semibold text-slate-500">Novo Usuário</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
              placeholder="Nome *"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-8"
              disabled={!selectedTenantId}
            />
            <Input
              placeholder="WhatsApp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="h-8"
              disabled={!selectedTenantId}
            />
            <Input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-8"
              disabled={!selectedTenantId}
            />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={!selectedTenantId || !nome.trim()}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
          {!selectedTenantId && (
            <p className="text-xs text-slate-400">
              Selecione um tenant à esquerda para criar usuários.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
