import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { useActiveContext } from '@/stores/useActiveContext'
import { useAuth } from '@/hooks/use-auth'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'

export default function Settings() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { tenantId: activeTenantId } = useActiveContext()
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingRole, setCheckingRole] = useState(true)

  useEffect(() => {
    async function loadTenantName() {
      if (activeTenantId) {
        const { data } = await supabase
          .from('tenants')
          .select('nome')
          .eq('id', activeTenantId)
          .single()
        setTenantName(data?.nome ?? null)
      } else {
        setTenantName(null)
      }
    }
    loadTenantName()
  }, [activeTenantId])

  useEffect(() => {
    setLoading(false)
  }, [])

  useEffect(() => {
    async function checkRoleAndKey() {
      setCheckingRole(true)
      if (!activeTenantId || !user?.email) {
        setIsAdmin(false)
        setHasKey(false)
        setCheckingRole(false)
        return
      }

      const { data: usuarioData } = await supabase
        .from('usuarios')
        .select('papel')
        .eq('tenant_id', activeTenantId)
        .eq('email', user.email)
        .eq('ativo', true)
        .maybeSingle()

      setIsAdmin(usuarioData?.papel === 'admin')

      const { data: keyData } = await supabase
        .from('ai_provider_keys')
        .select('provider')
        .eq('tenant_id', activeTenantId)
        .eq('provider', 'openai')
        .maybeSingle()

      setHasKey(!!keyData)
      setCheckingRole(false)
    }
    checkRoleAndKey()
  }, [activeTenantId, user?.email])

  const handleSaveKey = async () => {
    const trimmed = apiKey.trim()
    if (!trimmed || savingKey || !activeTenantId) return
    setSavingKey(true)
    try {
      const { error } = await supabase.functions.invoke('provider-save-key', {
        body: { tenant_id: activeTenantId, provider: 'openai', api_key: trimmed },
      })
      if (error) throw error
      toast({
        title: 'Chave salva',
        description: 'A chave da OpenAI foi salva com segurança para a empresa.',
      })
      setApiKey('')
      setHasKey(true)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar chave',
        description: err?.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      })
    } finally {
      setSavingKey(false)
    }
  }

  if (!activeTenantId)
    return (
      <div className="p-8 text-center text-muted-foreground">
        Selecione um tenant em{' '}
        <Link to="/contas" className="text-indigo-600 underline">
          Contas
        </Link>
      </div>
    )

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in-up p-8">
      <PageHeader
        title={
          <>
            Configurações
            {tenantName && (
              <span className="text-muted-foreground font-normal">
                {' · '}
                {tenantName}{' '}
                <Link
                  to="/contas"
                  className="text-indigo-600 text-sm font-medium underline hover:text-indigo-700"
                >
                  trocar
                </Link>
              </span>
            )}
          </>
        }
        subtitle="Gerencie integrações e preferências da conta."
      />

      <Card>
        <CardHeader>
          <CardTitle>Chave de IA da {tenantName ?? 'empresa'}</CardTitle>
          <CardDescription>
            Esta chave é usada por todos os membros da {tenantName ?? 'empresa'} e o consumo é
            cobrado na conta OpenAI dela. Cada empresa tem a sua.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {checkingRole ? (
            <p className="text-sm text-muted-foreground">Verificando permissões...</p>
          ) : isAdmin ? (
            <>
              {hasKey ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-slate-600">
                    Chave configurada para {tenantName ?? 'esta empresa'}.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm text-slate-600">
                    A {tenantName ?? 'empresa'} ainda não tem chave de IA. Os agentes e a análise de
                    currículo não funcionam sem ela.
                  </span>
                </div>
              )}
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                {hasKey && (
                  <p className="text-xs text-muted-foreground">
                    Uma chave já está configurada. Cole uma nova para substituir.
                  </p>
                )}
              </div>
              <Button
                onClick={handleSaveKey}
                disabled={!apiKey.trim() || savingKey || !activeTenantId}
              >
                {savingKey ? 'Salvando...' : 'Salvar chave'}
              </Button>
            </>
          ) : hasKey ? (
            <p className="text-sm text-muted-foreground">
              A chave de IA da {tenantName ?? 'empresa'} foi configurada pelo administrador.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              A {tenantName ?? 'empresa'} ainda não tem chave de IA. Peça ao administrador para
              configurar.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp da {tenantName ?? 'empresa'}</CardTitle>
          <CardDescription>O canal por onde os agentes falam com candidatos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-sm text-slate-600">Não conectado</span>
          </div>
          <Button disabled>Conectar WhatsApp</Button>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            A conexão é feita por QR code, lido pelo celular da empresa. Disponível quando o canal
            for ligado.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
