import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { MailCheck, Play, Building2, User as UserIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const DEMO_EMAIL = 'michel.andre+demo@gmail.com'
const DEMO_PASSWORD = 'lynxs-demo-2026'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [signupPath, setSignupPath] = useState<'admin' | 'user'>('user')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await signIn(email, password)
    if (error) {
      toast({ title: 'Erro ao fazer login', description: error.message, variant: 'destructive' })
    } else {
      navigate('/')
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não coincidem.', variant: 'destructive' })
      return
    }
    if (password.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      })
      return
    }

    const metadata =
      signupPath === 'admin'
        ? { full_name: fullName, pretende_criar_empresa: companyName }
        : undefined

    const { data, error } = await signUp(email, password, metadata)
    if (error) {
      toast({ title: 'Erro ao criar conta', description: error.message, variant: 'destructive' })
      return
    }
    if (!data?.session) {
      setShowConfirmation(true)
    } else {
      navigate('/')
    }
  }

  const handleDemoLogin = async () => {
    setDemoLoading(true)
    const { error } = await signIn(DEMO_EMAIL, DEMO_PASSWORD)
    setDemoLoading(false)
    if (error) {
      toast({
        title: 'Conta de demonstração indisponível no momento.',
        variant: 'destructive',
      })
    } else {
      navigate('/')
    }
  }

  if (showConfirmation) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Verifique seu email</CardTitle>
            <CardDescription>Quase lá!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Verifique seu email para confirmar a conta.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowConfirmation(false)
                setMode('login')
                setPassword('')
                setConfirmPassword('')
              }}
            >
              Voltar para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isSignUp = mode === 'signup'
  const isAdminPath = signupPath === 'admin'

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>{isSignUp ? 'Criar conta' : 'Login'}</CardTitle>
          <CardDescription>
            {isSignUp ? 'Crie sua conta para começar' : 'Entre na sua conta para continuar'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSignUp && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setSignupPath('user')}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors',
                  signupPath === 'user'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <UserIcon className="w-5 h-5 text-slate-600" />
                <span className="text-xs font-medium text-slate-700">Usuário (Convidado)</span>
              </button>
              <button
                type="button"
                onClick={() => setSignupPath('admin')}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors',
                  signupPath === 'admin'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <Building2 className="w-5 h-5 text-slate-600" />
                <span className="text-xs font-medium text-slate-700">
                  Administrador (Criar Empresa)
                </span>
              </button>
            </div>
          )}

          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {isAdminPath && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="full-name">Nome completo</Label>
                      <Input
                        id="full-name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Nome da empresa</Label>
                      <Input
                        id="company-name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                      />
                    </div>
                  </>
                )}
              </>
            )}
            <Button type="submit" className="w-full">
              {isSignUp ? 'Criar conta' : 'Entrar'}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleDemoLogin}
            disabled={demoLoading}
          >
            <Play className="mr-2 h-4 w-4" />
            {demoLoading ? 'Entrando...' : 'Ver demonstração'}
          </Button>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(isSignUp ? 'login' : 'signup')
                setConfirmPassword('')
              }}
              className="text-sm text-primary hover:underline transition-colors"
            >
              {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar conta'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
