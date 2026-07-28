import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import {
  LayoutDashboard,
  Settings,
  Menu,
  X,
  ClipboardList,
  Mic,
  Target,
  CreditCard,
  LayoutGrid,
  HelpCircle,
  MessageSquare,
  ChevronLeft,
  Database,
  Loader2,
  FileText,
  BarChart3,
  Building2,
  ArrowLeftRight,
  User,
  Users,
  Activity,
  Plus,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase/client'
import { useActiveContext } from '@/stores/useActiveContext'
import { NotificationBell } from '@/components/NotificationBell'
import { GlobalSearch } from '@/components/GlobalSearch'
import { triggerPlanejador, triggerExecutor } from '@/services/agentes-planejador'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut, papelAtivo } = useAuth()
  const isMobile = useIsMobile()
  const [isSidebarOpen, setSidebarOpen] = useState(false)

  const [activeAgents, setActiveAgents] = useState<string[]>([])
  const [agentsLoaded, setAgentsLoaded] = useState(false)
  const [contextTenantName, setContextTenantName] = useState<string | null>(null)
  const [contextUserName, setContextUserName] = useState<string | null>(null)
  const { tenantId: activeTenantId, usuarioId: activeUsuarioId } = useActiveContext()

  const closeSidebar = () => setSidebarOpen(false)
  const { toast } = useToast()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleBack = useCallback(() => {
    if (window.history.state?.idx > 0) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }, [navigate])

  useEffect(() => {
    async function loadAgents() {
      if (!user) {
        setAgentsLoaded(true)
        return
      }
      if (!activeTenantId) {
        return
      }
      const { data } = await supabase
        .from('acesso_agentes')
        .select('agente_id')
        .eq('tenant_id', activeTenantId)
        .eq('ativo', true)

      if (data) {
        setActiveAgents(data.map((d) => d.agente_id))
      }
      setAgentsLoaded(true)
    }
    loadAgents()
  }, [user, activeTenantId])

  useEffect(() => {
    triggerPlanejador().catch(() => {})
    triggerExecutor().catch(() => {})
  }, [])

  useEffect(() => {
    async function loadContextNames() {
      if (activeTenantId) {
        const { data } = await supabase
          .from('tenants')
          .select('nome')
          .eq('id', activeTenantId)
          .single()
        setContextTenantName(data?.nome ?? null)
      } else {
        setContextTenantName(null)
      }
      if (activeTenantId && activeUsuarioId) {
        const { data } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', activeUsuarioId)
          .single()
        setContextUserName(data?.nome ?? null)
      } else {
        setContextUserName(null)
      }
    }
    loadContextNames()
  }, [activeTenantId, activeUsuarioId])

  useEffect(() => {
    triggerPlanejador().catch(() => {})
    triggerExecutor().catch(() => {})
  }, [])

  // Route Guard
  useEffect(() => {
    if (agentsLoaded) {
      let isUnauthorized = false
      if (
        (location.pathname.startsWith('/vagas') ||
          location.pathname.startsWith('/agenda') ||
          location.pathname.startsWith('/agente-01')) &&
        !activeAgents.includes('01')
      ) {
        isUnauthorized = true
      }
      if (
        (location.pathname.startsWith('/entrevistas') ||
          location.pathname.startsWith('/agente-02')) &&
        !activeAgents.includes('02')
      ) {
        isUnauthorized = true
      }
      if (
        (location.pathname.startsWith('/candidatos') ||
          location.pathname.startsWith('/agente-03')) &&
        !activeAgents.includes('03')
      ) {
        isUnauthorized = true
      }

      if (isUnauthorized) {
        toast({
          title: 'Acesso Negado',
          description: 'Você não tem um plano ativo para este módulo.',
          variant: 'destructive',
        })
        navigate('/')
      }
    }
  }, [location.pathname, agentsLoaded, activeAgents, navigate, toast])

  if (!agentsLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const avatarInitials = contextUserName
    ? getInitials(contextUserName)
    : contextTenantName
      ? getInitials(contextTenantName)
      : null

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 animate-fade-in-up duration-200"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-[#2B1F3D] border-r border-[#3D2E52] transform transition-transform duration-300 ease-in-out flex flex-col',
          isMobile
            ? isSidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full'
            : 'translate-x-0 relative',
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-[#3D2E52] justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-xl">
            <div className="w-8 h-8 rounded-lg bg-agente-copiloto text-[#04342C] font-semibold flex items-center justify-center text-sm">
              L
            </div>
            <span>Lynxs</span>
          </div>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={closeSidebar}>
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        <nav className="flex-1 py-6 px-4 space-y-8 overflow-y-auto">
          {/* Meus Agentes */}
          <div className="space-y-1">
            <div className="px-3 text-xs font-semibold text-[#8E82A3] uppercase tracking-wider mb-2">
              Meus Agentes
            </div>
            <Link
              to="/"
              onClick={isMobile ? closeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname === '/'
                  ? 'bg-[#4A3A6B] text-white'
                  : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
              )}
            >
              <LayoutDashboard
                className={cn(
                  'w-5 h-5',
                  location.pathname === '/' ? 'text-white' : 'text-[#8E82A3]',
                )}
              />
              Dashboard
            </Link>

            <Link
              to="/painel"
              onClick={isMobile ? closeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname === '/painel'
                  ? 'bg-[#4A3A6B] text-white'
                  : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
              )}
            >
              <LayoutGrid
                className={cn(
                  'w-5 h-5',
                  location.pathname === '/painel' ? 'text-white' : 'text-[#8E82A3]',
                )}
              />
              Painel Unificado
            </Link>

            <Link
              to="/relatorios"
              onClick={isMobile ? closeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname.startsWith('/relatorios')
                  ? 'bg-[#4A3A6B] text-white'
                  : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
              )}
            >
              <BarChart3
                className={cn(
                  'w-5 h-5',
                  location.pathname.startsWith('/relatorios') ? 'text-white' : 'text-[#8E82A3]',
                )}
              />
              Relatórios
            </Link>

            {activeAgents.includes('01') && (
              <Link
                to="/agente-01"
                onClick={isMobile ? closeSidebar : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname.startsWith('/vagas') ||
                    location.pathname.startsWith('/agenda') ||
                    location.pathname.startsWith('/agente-01')
                    ? 'bg-[#4A3A6B] text-white'
                    : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
                )}
              >
                <ClipboardList
                  className={cn(
                    'w-5 h-5',
                    location.pathname.startsWith('/vagas') ||
                      location.pathname.startsWith('/agenda') ||
                      location.pathname.startsWith('/agente-01')
                      ? 'text-white'
                      : 'text-[#8E82A3]',
                  )}
                />
                Meu Assessor
              </Link>
            )}

            {activeAgents.includes('02') && (
              <Link
                to="/agente-02"
                onClick={isMobile ? closeSidebar : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname.startsWith('/entrevistas') ||
                    location.pathname.startsWith('/agente-02')
                    ? 'bg-[#4A3A6B] text-white'
                    : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
                )}
              >
                <Mic
                  className={cn(
                    'w-5 h-5',
                    location.pathname.startsWith('/entrevistas') ||
                      location.pathname.startsWith('/agente-02')
                      ? 'text-white'
                      : 'text-[#8E82A3]',
                  )}
                />
                Copiloto
              </Link>
            )}

            {activeAgents.includes('03') && (
              <Link
                to="/agente-03"
                onClick={isMobile ? closeSidebar : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname.startsWith('/candidatos') ||
                    location.pathname.startsWith('/agente-03')
                    ? 'bg-[#4A3A6B] text-white'
                    : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
                )}
              >
                <Target
                  className={cn(
                    'w-5 h-5',
                    location.pathname.startsWith('/candidatos') ||
                      location.pathname.startsWith('/agente-03')
                      ? 'text-white'
                      : 'text-[#8E82A3]',
                  )}
                />
                Base Ativa
              </Link>
            )}

            <Link
              to="/conversas"
              onClick={isMobile ? closeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname.startsWith('/conversas')
                  ? 'bg-[#4A3A6B] text-white'
                  : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
              )}
            >
              <MessageSquare
                className={cn(
                  'w-5 h-5',
                  location.pathname.startsWith('/conversas') ? 'text-white' : 'text-[#8E82A3]',
                )}
              />
              Conversas
            </Link>

            <Link
              to="/agentes/central"
              onClick={isMobile ? closeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname.startsWith('/agentes/central')
                  ? 'bg-[#4A3A6B] text-white'
                  : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
              )}
            >
              <Activity
                className={cn(
                  'w-5 h-5',
                  location.pathname.startsWith('/agentes/central')
                    ? 'text-white'
                    : 'text-[#8E82A3]',
                )}
              />
              Central de Agentes
            </Link>
          </div>

          {/* Context Indicator */}
          <Link
            to="/contas"
            onClick={isMobile ? closeSidebar : undefined}
            className="mx-1 mb-2 flex items-center gap-2 rounded-lg border border-[#4A3A6B] bg-[#372A50] px-3 py-2 transition-colors hover:bg-[#4A3A6B]"
          >
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {contextTenantName || 'Sem tenant'}
              </p>
              {activeTenantId && !activeUsuarioId ? (
                <Link
                  to="/contas"
                  onClick={isMobile ? closeSidebar : undefined}
                  className="text-xs text-agente-assessor hover:text-white"
                >
                  escolher usuário →
                </Link>
              ) : (
                <p className="text-xs text-[#8E82A3] truncate">
                  {contextUserName || 'sem usuário'}
                </p>
              )}
            </div>
            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </Link>

          {/* Minha Conta */}
          <div className="space-y-1">
            <div className="px-3 text-xs font-semibold text-[#8E82A3] uppercase tracking-wider mb-2">
              Minha Conta
            </div>
            <Link
              to="/contas"
              onClick={isMobile ? closeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname.startsWith('/contas')
                  ? 'bg-[#4A3A6B] text-white'
                  : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
              )}
            >
              <Building2
                className={cn(
                  'w-5 h-5',
                  location.pathname.startsWith('/contas') ? 'text-white' : 'text-[#8E82A3]',
                )}
              />
              Minhas empresas
            </Link>
            <Link
              to="/criar-empresa"
              onClick={isMobile ? closeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname.startsWith('/criar-empresa')
                  ? 'bg-[#4A3A6B] text-white'
                  : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
              )}
            >
              <Plus
                className={cn(
                  'w-5 h-5',
                  location.pathname.startsWith('/criar-empresa') ? 'text-white' : 'text-[#8E82A3]',
                )}
              />
              Criar empresa
            </Link>
            {papelAtivo === 'admin' && (
              <Link
                to="/membros"
                onClick={isMobile ? closeSidebar : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname.startsWith('/membros')
                    ? 'bg-[#4A3A6B] text-white'
                    : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
                )}
              >
                <Users
                  className={cn(
                    'w-5 h-5',
                    location.pathname.startsWith('/membros') ? 'text-white' : 'text-[#8E82A3]',
                  )}
                />
                Membros
              </Link>
            )}
            <Link
              to="/plano-cobranca"
              onClick={isMobile ? closeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname.startsWith('/plano-cobranca')
                  ? 'bg-[#4A3A6B] text-white'
                  : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
              )}
            >
              <CreditCard
                className={cn(
                  'w-5 h-5',
                  location.pathname.startsWith('/plano-cobranca') ? 'text-white' : 'text-[#8E82A3]',
                )}
              />
              Plano & Cobrança
            </Link>
            <Link
              to="/configuracoes"
              onClick={isMobile ? closeSidebar : undefined}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5 text-slate-400" /> Configurações
            </Link>
          </div>

          {/* Suporte */}
          <div className="space-y-1">
            <div className="px-3 text-xs font-semibold text-[#8E82A3] uppercase tracking-wider mb-2">
              Suporte
            </div>
            <Link
              to="/revisao-dados"
              onClick={isMobile ? closeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname.startsWith('/revisao-dados')
                  ? 'bg-[#4A3A6B] text-white'
                  : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
              )}
            >
              <Database
                className={cn(
                  'w-5 h-5',
                  location.pathname.startsWith('/revisao-dados') ? 'text-white' : 'text-[#8E82A3]',
                )}
              />
              Inspeção
            </Link>
            <Link
              to="/teste-cv"
              onClick={isMobile ? closeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname.startsWith('/teste-cv')
                  ? 'bg-[#4A3A6B] text-white'
                  : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
              )}
            >
              <FileText
                className={cn(
                  'w-5 h-5',
                  location.pathname.startsWith('/teste-cv') ? 'text-white' : 'text-[#8E82A3]',
                )}
              />
              Testes AI
            </Link>
            <Link
              to="/ajuda"
              onClick={isMobile ? closeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname.startsWith('/ajuda')
                  ? 'bg-[#4A3A6B] text-white'
                  : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
              )}
            >
              <HelpCircle
                className={cn(
                  'w-5 h-5',
                  location.pathname.startsWith('/ajuda') ? 'text-white' : 'text-[#8E82A3]',
                )}
              />
              Central de Ajuda
            </Link>
            <Link
              to="/contato"
              onClick={isMobile ? closeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname.startsWith('/contato')
                  ? 'bg-[#4A3A6B] text-white'
                  : 'text-[#C4BAD2] hover:bg-[#3D2E52] hover:text-white',
              )}
            >
              <MessageSquare
                className={cn(
                  'w-5 h-5',
                  location.pathname.startsWith('/contato') ? 'text-white' : 'text-[#8E82A3]',
                )}
              />
              Contato
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="-ml-2"
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}

            {location.pathname !== '/' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                className="hidden sm:flex gap-1.5 text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" /> Voltar
              </Button>
            )}

            <GlobalSearch />
          </div>

          <div className="flex items-center gap-3">
            {location.pathname !== '/' && isMobile && (
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {avatarInitials ? avatarInitials : <User className="w-4 h-4" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <Link to="/contas" className="text-xs text-indigo-600 hover:underline">
                      Operando: {contextUserName || 'Sem usuário'} ·{' '}
                      {contextTenantName || 'Sem tenant'}
                    </Link>
                    <p className="text-xs leading-none text-muted-foreground">
                      Login: {user?.email || '—'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/plano-cobranca')}>
                  Plano & Cobrança
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 mt-1"
                >
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
          <div className="max-w-7xl mx-auto animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
