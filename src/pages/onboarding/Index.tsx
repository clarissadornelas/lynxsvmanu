import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardTab } from './components/DashboardTab'
import { CandidatosTab } from './components/CandidatosTab'
import { FollowUpsTab } from './components/FollowUpsTab'
import { HistoricoTab } from './components/HistoricoTab'

export default function Onboarding() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Onboarding 90 Dias</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Acompanhamento de candidatos recém-contratados e Follow-ups automáticos.
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="candidatos">Candidatos</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="m-0 focus-visible:outline-none">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="candidatos" className="m-0 focus-visible:outline-none">
          <CandidatosTab />
        </TabsContent>
        <TabsContent value="followups" className="m-0 focus-visible:outline-none">
          <FollowUpsTab />
        </TabsContent>
        <TabsContent value="historico" className="m-0 focus-visible:outline-none">
          <HistoricoTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
