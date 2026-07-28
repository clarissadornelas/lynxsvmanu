import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useActiveContext } from '@/stores/useActiveContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { InviteDialog } from '@/components/InviteDialog'
import { ShieldOff, ArrowLeft, Loader2, UserPlus, Power, ShieldCheck } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface Membro {
  id: string
  nome: string
  email: string | null
  papel: string
  ativo: boolean
  criado_em: string
}

export default function Membros() {
  const { user, papelAtivo } = useAuth()
  const { tenantId } = useActiveContext()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [membros, setMembros] = useState<Membro[]>([])
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('usuario')
  const [submitting, setSubmitting] = useState(false)
  const [pending, setPending] = useState<{ m: Membro; type: 'role' | 'status' } | null>(null)
  const [tenantName, setTenantName] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteText, setInviteText] = useState('')

  const fetchMembros = useCallback(async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, email, papel, ativo, criado_em')
      .eq('tenant_id', tenantId)
      .order('criado_em')
    setMembros((data || []) as Membro[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    fetchMembros()
  }, [fetchMembros])

  useEffect(() => {
    if (!tenantId)
      return supabase
        .from('tenants')
        .select('nome')
        .eq('id', tenantId)
        .single()
        .then(({ data }) => setTenantName(data?.nome ?? ''))
  }, [tenantId])

  const adminCount = membros.filter((m) => m.papel === 'admin' && m.ativo).length
  const isSelf = (m: Membro) => m.email === user?.email
  const isLastAdmin = (m: Membro) => m.papel === 'admin' && m.ativo && adminCount <= 1

  const handleAdd = async () => {
    if (!nome.trim() || !email.trim() || !tenantId) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: 'Email inválido', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    const { error } = await supabase
      .from('usuarios')
      .insert({ nome: nome.trim(), email: email.trim(), papel, tenant_id: tenantId, ativo: true })
    setSubmitting(false)
    if (error?.code === '23505') {
      toast({ title: 'Este email já é membro desta empresa.', variant: 'destructive' })
      return
    }
    if (error) {
      toast({ title: 'Erro ao adicionar membro.', variant: 'destructive' })
      return
    }
    setInviteText(
      `Olá, ${nome.trim()}! Te adicionei na ${tenantName} dentro do Lynxs, nossa plataforma de recrutamento. Crie sua conta em ${window.location.origin} usando este email (${email.trim()}), na opção 'Sou usuário — fui convidado por uma empresa'. Seu acesso já estará liberado ao entrar.`,
    )
    setInviteOpen(true)
    toast({
      title: `Membro adicionado. Assim que ${email.trim()} entrar com este email, o acesso estará liberado.`,
    })
    setNome('')
    setEmail('')
    setPapel('usuario')
    fetchMembros()
  }

  const handleConfirm = async () => {
    if (!pending) return
    const { m, type } = pending
    const updates =
      type === 'role' ? { papel: m.papel === 'admin' ? 'usuario' : 'admin' } : { ativo: !m.ativo }
    const { error } = await supabase.from('usuarios').update(updates).eq('id', m.id)
    setPending(null)
    if (error) {
      toast({ title: 'Erro ao atualizar membro.', variant: 'destructive' })
      return
    }
    toast({ title: 'Membro atualizado com sucesso.' })
    fetchMembros()
  }

  if (papelAtivo !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldOff className="w-12 h-12 text-slate-300" />
        <p className="text-lg font-medium text-slate-600">
          Apenas administradores gerenciam membros
        </p>
        <Button variant="outline" className="gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Membros</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie os membros da sua organização</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            Adicionar Membro
          </CardTitle>
          <p className="text-xs text-slate-500">
            Nenhum email automático é enviado. Ao adicionar, você recebe o texto de convite para
            compartilhar.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do membro"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com"
                type="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Papel</Label>
              <Select value={papel} onValueChange={setPapel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Administradores gerenciam membros e compras desta empresa. Para fundar uma nova
                empresa, use Criar empresa no menu.
              </p>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!nome.trim() || !email.trim() || submitting}
                onClick={handleAdd}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            Membros ({membros.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membros.map((m) => {
                const self = isSelf(m)
                const lastAdmin = isLastAdmin(m)
                const disabled = self || lastAdmin
                const roleTip = lastAdmin
                  ? 'Não é possível remover o último administrador ativo.'
                  : self
                    ? 'Você não pode alterar seu próprio papel'
                    : `Alterar para ${m.papel === 'admin' ? 'Usuário' : 'Administrador'}`
                const statusTip = lastAdmin
                  ? 'Não é possível remover o último administrador ativo.'
                  : self
                    ? 'Você não pode desativar a si mesmo'
                    : m.ativo
                      ? 'Desativar'
                      : 'Ativar'
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell className="text-slate-500">{m.email || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={m.papel === 'admin' ? 'default' : 'secondary'}
                          className={cn(
                            m.papel === 'admin' &&
                              'bg-indigo-100 text-indigo-700 hover:bg-indigo-100',
                          )}
                        >
                          {m.papel === 'admin' ? 'Administrador' : 'Usuário'}
                        </Badge>
                        {!m.ativo && (
                          <Badge variant="outline" className="text-red-600 border-red-300">
                            Inativo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {format(new Date(m.criado_em), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  disabled={disabled}
                                  onClick={() => setPending({ m, type: 'role' })}
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{roleTip}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  disabled={disabled}
                                  onClick={() => setPending({ m, type: 'status' })}
                                >
                                  <Power className="w-4 h-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{statusTip}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.type === 'role'
                ? `Deseja alterar o papel de ${pending.m.nome} para ${pending.m.papel === 'admin' ? 'Usuário' : 'Administrador'}?`
                : `Deseja ${pending?.m.ativo ? 'desativar' : 'ativar'} o membro ${pending?.m.nome}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} inviteText={inviteText} />
    </div>
  )
}
