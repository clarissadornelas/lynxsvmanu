import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CopilotConfigForm } from '@/components/CopilotConfigForm'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Save, Activity } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useActiveContext } from '@/stores/useActiveContext'
import { supabase } from '@/lib/supabase/client'

type AgentType = 'assessor' | 'copiloto' | 'base_ativa'

interface AgentConfig {
  id?: string
  nome_agente: string | null
  mensagem_apresentacao: string | null
  tom: string
  tom_detalhe: string | null
  dias_sem_resposta: number | null
  cadencia_follow_up_dias: number | null
}

const AGENT_LABELS: Record<AgentType, string> = {
  assessor: 'Meu Assessor',
  copiloto: 'Copiloto',
  base_ativa: 'Base Ativa',
}

const DEFAULTS: Record<AgentType, AgentConfig> = {
  assessor: {
    nome_agente: '',
    mensagem_apresentacao: '',
    tom: 'profissional',
    tom_detalhe: '',
    dias_sem_resposta: 5,
    cadencia_follow_up_dias: null,
  },
  copiloto: {
    nome_agente: '',
    mensagem_apresentacao: '',
    tom: 'profissional',
    tom_detalhe: '',
    dias_sem_resposta: null,
    cadencia_follow_up_dias: null,
  },
  base_ativa: {
    nome_agente: '',
    mensagem_apresentacao: '',
    tom: 'profissional',
    tom_detalhe: '',
    dias_sem_resposta: null,
    cadencia_follow_up_dias: 7,
  },
}

function ConfigForm({
  agentType,
  tenantName,
}: {
  agentType: AgentType
  tenantName: string | null
}) {
  const { toast } = useToast()
  const { tenantId } = useActiveContext()
  const [config, setConfig] = useState<AgentConfig>(DEFAULTS[agentType])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [janelaInicio, setJanelaInicio] = useState(8)
  const [janelaFim, setJanelaFim] = useState(18)

  useEffect(() => {
    setConfig(DEFAULTS[agentType])
    setLoading(true)

    async function load() {
      if (!tenantId) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('configuracoes_agente')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('agent_type', agentType)
        .maybeSingle()

      if (data) {
        setConfig({
          id: data.id,
          nome_agente: data.nome_agente ?? '',
          mensagem_apresentacao: data.mensagem_apresentacao ?? '',
          tom: data.tom ?? 'profissional',
          tom_detalhe: data.tom_detalhe ?? '',
          dias_sem_resposta: data.dias_sem_resposta ?? DEFAULTS[agentType].dias_sem_resposta,
          cadencia_follow_up_dias:
            data.cadencia_follow_up_dias ?? DEFAULTS[agentType].cadencia_follow_up_dias,
        })
      }

      if (agentType === 'assessor') {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('janela_inicio, janela_fim')
          .eq('id', tenantId)
          .single()
        if (tenant) {
          setJanelaInicio(tenant.janela_inicio ?? 8)
          setJanelaFim(tenant.janela_fim ?? 18)
        }
      }

      setLoading(false)
    }
    load()
  }, [agentType, tenantId])

  const handleSave = useCallback(async () => {
    if (!tenantId || saving) return
    setSaving(true)

    try {
      let finalTomDetalhe = config.tom_detalhe?.trim() || null

      if (finalTomDetalhe) {
        const { data: validationResult, error: validationError } = await supabase.functions.invoke(
          'validar-tom-agente',
          {
            body: { texto: finalTomDetalhe },
          },
        )

        if (validationError) throw validationError

        if (validationResult.motivo === 'chave_ausente') {
          toast({
            title: 'Chave OpenAI ausente',
            description:
              'Configure uma chave OpenAI em Configurações para validar o tom. Os demais campos serão salvos sem os detalhes do tom.',
          })
          finalTomDetalhe = null
        } else if (!validationResult.permitido) {
          toast({
            title: 'Tom rejeitado',
            description: `Este texto não pode ser usado: ${validationResult.motivo}`,
            variant: 'destructive',
          })
          setSaving(false)
          return
        }
      }

      const upsertPayload: Record<string, unknown> = {
        tenant_id: tenantId,
        agent_type: agentType,
        nome_agente: config.nome_agente?.trim() || null,
        mensagem_apresentacao: config.mensagem_apresentacao?.trim() || null,
        tom: config.tom,
        tom_detalhe: finalTomDetalhe,
        dias_sem_resposta: config.dias_sem_resposta,
        cadencia_follow_up_dias: config.cadencia_follow_up_dias,
      }

      const { data: saved, error: saveError } = await supabase
        .from('configuracoes_agente')
        .upsert(upsertPayload, { onConflict: 'tenant_id,agent_type' })
        .select()
        .single()

      if (saveError) throw saveError

      if (agentType === 'assessor') {
        const { error: tenantError } = await supabase
          .from('tenants')
          .update({ janela_inicio: janelaInicio, janela_fim: janelaFim })
          .eq('id', tenantId)

        if (tenantError) throw tenantError
      }

      if (saved) {
        setConfig((prev) => ({ ...prev, id: saved.id }))
      }

      toast({ title: 'Configuração salva com sucesso!' })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }, [tenantId, saving, config, agentType, janelaInicio, janelaFim, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  const greetingPlaceholder = `Olá! Sou o assistente de recrutamento da ${tenantName || '{nome do tenant}'}. Vou te ajudar com o agendamento da sua entrevista.`

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Como ele se apresenta</CardTitle>
          <CardDescription>Defina o nome e a mensagem de saudação do agente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`nome-${agentType}`}>Nome do agente</Label>
            <Input
              id={`nome-${agentType}`}
              value={config.nome_agente ?? ''}
              maxLength={60}
              onChange={(e) => setConfig((prev) => ({ ...prev, nome_agente: e.target.value }))}
              placeholder="Ex.: Assessor Lynxs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`mensagem-${agentType}`}>Mensagem de apresentação</Label>
            <Textarea
              id={`mensagem-${agentType}`}
              value={config.mensagem_apresentacao ?? ''}
              maxLength={300}
              rows={3}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, mensagem_apresentacao: e.target.value }))
              }
              placeholder={greetingPlaceholder}
            />
            <p className="text-xs text-muted-foreground text-right">
              {(config.mensagem_apresentacao ?? '').length}/300
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tom de conversa</CardTitle>
          <CardDescription>Como o agente deve se comunicar com os candidatos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tom geral</Label>
            <RadioGroup
              value={config.tom}
              onValueChange={(val) => setConfig((prev) => ({ ...prev, tom: val }))}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="formal" id={`tom-formal-${agentType}`} />
                <Label htmlFor={`tom-formal-${agentType}`} className="cursor-pointer font-normal">
                  Formal
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="profissional" id={`tom-prof-${agentType}`} />
                <Label htmlFor={`tom-prof-${agentType}`} className="cursor-pointer font-normal">
                  Profissional cordial
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="casual" id={`tom-casual-${agentType}`} />
                <Label htmlFor={`tom-casual-${agentType}`} className="cursor-pointer font-normal">
                  Casual
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`tom-detalhe-${agentType}`}>Detalhes do tom (opcional)</Label>
            <Textarea
              id={`tom-detalhe-${agentType}`}
              value={config.tom_detalhe ?? ''}
              maxLength={280}
              rows={3}
              onChange={(e) => setConfig((prev) => ({ ...prev, tom_detalhe: e.target.value }))}
              placeholder="Ex.: usar emojis com moderação, mensagens curtas, tratar por você"
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Ex.: usar emojis com moderação, mensagens curtas, tratar por você
              </p>
              <p className="text-xs text-muted-foreground">
                {(config.tom_detalhe ?? '').length}/280
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como ele opera</CardTitle>
          <CardDescription>Parâmetros operacionais do agente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {agentType === 'assessor' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="janela-inicio">Início da janela (hora)</Label>
                  <Input
                    id="janela-inicio"
                    type="number"
                    min={0}
                    max={23}
                    value={janelaInicio}
                    onChange={(e) => setJanelaInicio(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="janela-fim">Fim da janela (hora)</Label>
                  <Input
                    id="janela-fim"
                    type="number"
                    min={0}
                    max={23}
                    value={janelaFim}
                    onChange={(e) => setJanelaFim(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Esta janela também aparece em Configurações.
              </p>
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="dias-sem-resposta">Dias sem resposta até desistir do contato</Label>
                <Input
                  id="dias-sem-resposta"
                  type="number"
                  min={1}
                  max={60}
                  value={config.dias_sem_resposta ?? 5}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      dias_sem_resposta: parseInt(e.target.value) || 5,
                    }))
                  }
                />
              </div>
            </>
          )}

          {agentType === 'base_ativa' && (
            <div className="space-y-2">
              <Label htmlFor="cadencia">Cadência de follow-up: a cada [n] dias</Label>
              <Input
                id="cadencia"
                type="number"
                min={1}
                max={180}
                value={config.cadencia_follow_up_dias ?? 7}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    cadencia_follow_up_dias: parseInt(e.target.value) || 7,
                  }))
                }
              />
            </div>
          )}

          {agentType === 'copiloto' && (
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              Os ajustes do Copiloto são feitos por tarefa, direto na Sala de Entrevista, pelo botão
              Refinar.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Salvar
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

const VALID_TABS: AgentType[] = ['assessor', 'copiloto', 'base_ativa']

export default function AgentesConfiguracoes() {
  const { tenantId } = useActiveContext()
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const abaParam = searchParams.get('aba') as AgentType | null
  const [activeTab, setActiveTab] = useState<AgentType>(
    abaParam && VALID_TABS.includes(abaParam) ? abaParam : 'assessor',
  )

  useEffect(() => {
    if (abaParam && VALID_TABS.includes(abaParam)) {
      setActiveTab(abaParam)
    }
  }, [abaParam])

  useEffect(() => {
    async function loadTenantName() {
      if (tenantId) {
        const { data } = await supabase.from('tenants').select('nome').eq('id', tenantId).single()
        setTenantName(data?.nome ?? null)
      } else {
        setTenantName(null)
      }
    }
    loadTenantName()
  }, [tenantId])

  return (
    <div className="space-y-6 animate-fade-in-up p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Configurar Agentes"
        subtitle="Personalize a identidade, o tom e os parâmetros operacionais dos seus agentes de IA."
      >
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link to="/agentes/central">
            <Activity className="w-4 h-4" /> Ver na Central
          </Link>
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AgentType)}>
        <TabsList>
          <TabsTrigger value="assessor">{AGENT_LABELS.assessor}</TabsTrigger>
          <TabsTrigger value="copiloto">{AGENT_LABELS.copiloto}</TabsTrigger>
          <TabsTrigger value="base_ativa">{AGENT_LABELS.base_ativa}</TabsTrigger>
        </TabsList>
        <TabsContent value="assessor" className="mt-6">
          <ConfigForm agentType="assessor" tenantName={tenantName} />
        </TabsContent>
        <TabsContent value="copiloto" className="mt-6">
          <CopilotConfigForm />
        </TabsContent>
        <TabsContent value="base_ativa" className="mt-6">
          <ConfigForm agentType="base_ativa" tenantName={tenantName} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
