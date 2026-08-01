import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { initActiveContext } from '@/stores/useActiveContext'

import BancadaEntrevista from './pages/BancadaEntrevista'
import CriarEmpresa from './pages/CriarEmpresa'
import Layout from './components/Layout'
import Index from './pages/Index'
import Dashboard from './pages/Dashboard'

import JobsList from './pages/vagas/JobsList'
import JobSetup from './pages/vagas/JobSetup'
import JobDetails from './pages/vagas/JobDetails'
import Candidates from './pages/Candidates'
import DossieCandidato from './pages/candidatos/DossieCandidato'
import CandidateProfile from './pages/candidatos/CandidateProfile'
import InterviewSetup from './pages/entrevistas/InterviewSetup'
import InterviewRoom from './pages/entrevistas/InterviewRoom'
import AvaliacaoEntrevista from './pages/entrevistas/AvaliacaoEntrevista'
import CandidateRoom from './pages/entrevistas/CandidateRoom'
import Agenda from './pages/Agenda'
import ConversationConsole from './pages/conversas/ConversationConsole'
import Settings from './pages/Settings'
import AgentesConfiguracoes from './pages/AgentesConfiguracoes'
import CentralAgentes from './pages/CentralAgentes'
import Contas from './pages/Contas'
import Membros from './pages/Membros'
import PlanoCobranca from './pages/PlanoCobranca'
import Ajuda from './pages/Ajuda'
import Contato from './pages/Contato'
import Relatorios from './pages/Relatorios'
import Login from './pages/Login'
import DataReview from './pages/DataReview'
import TesteCV from './pages/TesteCV'
import NotFound from './pages/NotFound'
import UnlinkedAccount from './pages/UnlinkedAccount'
import { AuthProvider, useAuth } from './hooks/use-auth'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, tenantLinked } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (tenantLinked === null) return null
  if (tenantLinked === false) {
    if (user?.user_metadata?.pretende_criar_empresa) {
      return <Navigate to="/criar-empresa" replace />
    }
    return <Navigate to="/sem-acesso" replace />
  }
  return <>{children}</>
}

const CriarEmpresaRoute = () => {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <CriarEmpresa />
}

const SemAcessoRoute = () => {
  const { user, loading, tenantLinked } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (tenantLinked === true) return <Navigate to="/" replace />
  return <UnlinkedAccount />
}

const AppRoutes = () => (
  <BrowserRouter>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/criar-empresa" element={<CriarEmpresaRoute />} />
        <Route path="/sem-acesso" element={<SemAcessoRoute />} />

        {/* Candidate Public Route */}
        <Route path="/candidato/entrevista/:id" element={<CandidateRoom />} />

        {/* Public Interview Bench */}
        <Route path="/bancada-entrevista" element={<BancadaEntrevista />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Index />} />

          <Route path="/painel" element={<Dashboard />} />

          <Route path="/relatorios" element={<Relatorios />} />

          <Route path="/agente-01" element={<Navigate to="/vagas" replace />} />
          <Route path="/agente-02" element={<Navigate to="/entrevistas" replace />} />
          <Route path="/agente-03" element={<Navigate to="/candidatos" replace />} />

          <Route path="/vagas" element={<JobsList />} />
          <Route path="/vagas/nova" element={<JobSetup />} />
          <Route path="/vagas/:id" element={<JobDetails />} />

          <Route path="/candidatos" element={<Candidates />} />
          <Route path="/candidatos/:id" element={<CandidateProfile />} />

          <Route path="/entrevistas" element={<InterviewSetup />} />
          <Route path="/entrevistas/nova" element={<InterviewSetup />} />
          <Route path="/entrevistas/:id" element={<InterviewRoom />} />
          <Route path="/avaliar/:id" element={<AvaliacaoEntrevista />} />
          <Route path="/dossie/:candidatoId" element={<DossieCandidato />} />

          <Route path="/agenda" element={<Agenda />} />
          <Route path="/conversas" element={<ConversationConsole />} />
          <Route path="/revisao-dados" element={<DataReview />} />
          <Route path="/teste-cv" element={<TesteCV />} />
          <Route path="/contas" element={<Contas />} />
          <Route path="/membros" element={<Membros />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/plano-cobranca" element={<PlanoCobranca />} />
          <Route path="/ajuda" element={<Ajuda />} />
          <Route path="/contato" element={<Contato />} />
          <Route path="/agentes/central" element={<CentralAgentes />} />
          <Route path="/agentes/configuracoes" element={<AgentesConfiguracoes />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </BrowserRouter>
)

const App = () => {
  useEffect(() => {
    initActiveContext()
  }, [])

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
