import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Save, ArrowRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useActiveContext } from '@/stores/useActiveContext'
import { supabase } from '@/lib/supabase/client'

export function CopilotConfigForm() {
  const { toast } = useToast()
  const { tenantId } = useActiveContext()
  const [criteriosCv, setCriteriosCv] = useState('')
  const [criteriosEntrevista, setCriteriosEntrevista] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    async function load() {
      if (!tenantId) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('configuracoes_agente')
        .select('criterios_cv, criterios_entrevista')
        .eq('tenant_id', tenantId)
        .eq('agent_type', 'copiloto')
        .maybeSingle()
      if (data) {
        setCriteriosCv(data.criterios_cv ?? '')
        setCriteriosEntrevista(data.criterios_entrevista ?? '')
      }
      setLoading(false)
    }
    load()
  }, [tenantId])

  const validateCriteria = useCallback(
    async (text: string): Promise<{ permitido: boolean; motivo: string }> => {
      const { data, error } = await supabase.functions.invoke('validar-tom-agente', {
        body: { texto: text, contexto: 'criterios' },
      })
      if (error) throw error
      return data
    },
    [],
  )

  const handleSave = useCallback(async () => {
    if (!tenantId || saving) return
    setSaving(true)
    try {
      const finalCv = criteriosCv.trim() || null
      const finalEntrevista = criteriosEntrevista.trim() || null
      let apiKeyMissing = false

      if (finalCv) {
        const result = await validateCriteria(finalCv)
        if (result.motivo === 'chave_ausente') {
          apiKeyMissing = true
          toast({
            title: 'Chave OpenAI ausente',
            description:
              'Configure uma chave OpenAI em Configurações para validar os critérios. Os critérios serão salvos sem validação.',
          })
        } else if (!result.permitido) {
          toast({
            title: 'Critério de CV rejeitado',
            description: result.motivo,
            variant: 'destructive',
          })
          setSaving(false)
          return
        }
      }

      if (finalEntrevista && !apiKeyMissing) {
        const result = await validateCriteria(finalEntrevista)
        if (result.motivo === 'chave_ausente') {
          toast({
            title: 'Chave OpenAI ausente',
            description:
              'Configure uma chave OpenAI em Configurações para validar os critérios. Os critérios serão salvos sem validação.',
          })
        } else if (!result.permitido) {
          toast({
            title: 'Critério de entrevista rejeitado',
            description: result.motivo,
            variant: 'destructive',
          })
          setSaving(false)
          return
        }
      }

      const upsertPayload = {
        tenant_id: tenantId,
        agent_type: 'copiloto' as const,
        criterios_cv: finalCv,
        criterios_entrevista: finalEntrevista,
      }

      const { error: saveError } = await supabase
        .from('configuracoes_agente')
        .upsert(upsertPayload, { onConflict: 'tenant_id,agent_type' })

      if (saveError) throw saveError

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
  }, [tenantId, saving, criteriosCv, criteriosEntrevista, validateCriteria, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>O Copiloto trabalha por dentro da entrevista</CardTitle>
          <CardDescription>
            Ele prepara o roteiro antes da conversa e analisa o candidato depois. Aqui você define
            os critérios que ele usa para avaliar.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Critérios de avaliação</CardTitle>
          <CardDescription>
            Defina o que o Copiloto deve valorizar ao analisar CVs e entrevistas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="criterios-cv">O que valorizar na análise de CVs</Label>
            <Textarea
              id="criterios-cv"
              value={criteriosCv}
              maxLength={600}
              rows={4}
              onChange={(e) => setCriteriosCv(e.target.value)}
              placeholder="Ex.: valorizamos estabilidade acima de 2 anos por empresa, experiência prática com as ferramentas da vaga, progressão de carreira consistente"
            />
            <p className="text-xs text-muted-foreground text-right">{criteriosCv.length}/600</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="criterios-entrevista">O que buscar nas entrevistas</Label>
            <Textarea
              id="criterios-entrevista"
              value={criteriosEntrevista}
              maxLength={600}
              rows={4}
              onChange={(e) => setCriteriosEntrevista(e.target.value)}
              placeholder="Ex.: exemplos concretos em vez de respostas genéricas, clareza ao explicar decisões, sinais de autonomia e de trabalho em equipe"
            />
            <p className="text-xs text-muted-foreground text-right">
              {criteriosEntrevista.length}/600
            </p>
          </div>
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

      <p className="text-sm text-muted-foreground">
        Ajustes pontuais de um roteiro ou análise são feitos na{' '}
        <Link
          to="/entrevistas"
          className="text-indigo-600 hover:underline inline-flex items-center gap-1"
        >
          Sala de Entrevista <ArrowRight className="w-3 h-3" />
        </Link>
        , pelo botão Refinar.
      </p>
    </div>
  )
}
