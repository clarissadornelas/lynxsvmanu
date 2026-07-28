import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useActiveContext } from '@/stores/useActiveContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Building2 } from 'lucide-react'

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40)
  return `${base}-${Math.random().toString(36).substring(2, 8)}`
}

export default function CriarEmpresa() {
  const { user } = useAuth()
  const { setActive } = useActiveContext()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [headhunterNome, setHeadhunterNome] = useState('')
  const [headhunterTelefone, setHeadhunterTelefone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !headhunterNome.trim() || !headhunterTelefone.trim()) return
    if (!user?.email) return

    setSubmitting(true)

    const slug = generateSlug(nome.trim())

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        slug,
        nome: nome.trim(),
        headhunter_nome: headhunterNome.trim(),
        headhunter_telefone: headhunterTelefone.trim(),
      })
      .select('id')
      .single()

    if (tenantError) {
      console.error('Erro ao criar empresa:', tenantError)
      toast({
        title: 'Erro ao criar empresa',
        description: tenantError.message,
        variant: 'destructive',
      })
      setSubmitting(false)
      return
    }

    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .insert({
        tenant_id: tenant.id,
        nome: headhunterNome.trim(),
        email: user.email,
        whatsapp: headhunterTelefone.trim(),
        papel: 'admin',
        ativo: true,
      })
      .select('id')
      .single()

    if (usuarioError) {
      console.error('Erro ao vincular usuário:', usuarioError)
      toast({
        title: 'Erro ao vincular usuário',
        description: usuarioError.message,
        variant: 'destructive',
      })
      setSubmitting(false)
      return
    }

    if (user.user_metadata?.pretende_criar_empresa) {
      await supabase.auth.updateUser({
        data: { pretende_criar_empresa: false },
      })
    }

    setActive(tenant.id, usuario.id)
    toast({ title: 'Empresa criada com sucesso!' })
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Criar empresa</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados da empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da empresa</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Consultoria RH Ltda"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="headhunter-nome">Seu nome</Label>
                <Input
                  id="headhunter-nome"
                  value={headhunterNome}
                  onChange={(e) => setHeadhunterNome(e.target.value)}
                  placeholder="Ex: Maria Silva"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="headhunter-telefone">Seu WhatsApp</Label>
                <Input
                  id="headhunter-telefone"
                  value={headhunterTelefone}
                  onChange={(e) => setHeadhunterTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>

              <p className="text-sm text-slate-500">
                Cada empresa tem seu próprio plano. A nova empresa começa sem agentes contratados.
              </p>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...
                  </>
                ) : (
                  'Criar empresa'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
