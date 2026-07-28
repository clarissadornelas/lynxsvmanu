import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Trash2, RefreshCw, Plus, AlertTriangle, ExternalLink } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  fetchAgendasExternas,
  createAgendaExterna,
  deleteAgendaExterna,
  syncAgendaIcal,
  countEventosAgendaExterna,
  type AgendaExterna,
} from '@/services/agendas-externas'

interface ExternalAgendaManagerProps {
  tenantId: string
}

export function ExternalAgendaManager({ tenantId }: ExternalAgendaManagerProps) {
  const { toast } = useToast()
  const [agendas, setAgendas] = useState<AgendaExterna[]>([])
  const [loading, setLoading] = useState(true)
  const [rotulo, setRotulo] = useState('')
  const [icalUrl, setIcalUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({})

  const loadAgendas = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetchAgendasExternas(tenantId)
    if (error) {
      toast({
        title: 'Erro ao carregar agendas',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      setAgendas(data)
      const counts: Record<string, number> = {}
      for (const a of data) {
        const { count } = await countEventosAgendaExterna(a.id)
        counts[a.id] = count
      }
      setEventCounts(counts)
    }
    setLoading(false)
  }, [tenantId, toast])

  useEffect(() => {
    loadAgendas()
  }, [loadAgendas])

  const handleAdd = async () => {
    const trimmedUrl = icalUrl.trim()
    if (!trimmedUrl || saving) return
    setSaving(true)
    const { data, error } = await createAgendaExterna(tenantId, rotulo.trim(), trimmedUrl)
    setSaving(false)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Agenda adicionada' })
      setRotulo('')
      setIcalUrl('')
      await loadAgendas()
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await deleteAgendaExterna(id)
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Agenda removida' })
      await loadAgendas()
    }
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    const { data, error } = await syncAgendaIcal(id)
    setSyncingId(null)
    if (error) {
      toast({ title: 'Erro na sincronização', description: error.message, variant: 'destructive' })
    } else if (data?.error) {
      toast({ title: 'Erro na sincronização', description: data.error, variant: 'destructive' })
    } else {
      toast({
        title: 'Sincronização concluída',
        description: `${data?.events_synced ?? 0} evento(s) sincronizado(s).`,
      })
      await loadAgendas()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda externa (iCal)</CardTitle>
        <CardDescription>
          Conecte seu Google Calendar via link iCal secreto para sincronizar compromissos externos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
          <p className="font-medium">Como obter o link iCal do Google Calendar:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Acesse o Google Calendar → Configurações</li>
            <li>Selecione o calendário desejado na lista lateral</li>
            <li>Role até "Integrar calendário"</li>
            <li>Copie o "Endereço secreto no formato iCal"</li>
          </ol>
          <a
            href="https://calendar.google.com/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
          >
            Abrir Google Calendar <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Este link dá acesso de leitura à sua agenda. Não compartilhe.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Rótulo</Label>
              <Input
                value={rotulo}
                onChange={(e) => setRotulo(e.target.value)}
                placeholder="Ex: Agenda principal"
              />
            </div>
            <div className="space-y-2">
              <Label>URL do iCal</Label>
              <Input
                value={icalUrl}
                onChange={(e) => setIcalUrl(e.target.value)}
                placeholder="https://calendar.google.com/..."
                type="url"
              />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={!icalUrl.trim() || saving}>
            <Plus className="mr-2 h-4 w-4" />
            {saving ? 'Adicionando...' : 'Adicionar agenda'}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando agendas...</p>
        ) : agendas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma agenda externa configurada.</p>
        ) : (
          <div className="space-y-3">
            {agendas.map((agenda) => (
              <div
                key={agenda.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{agenda.rotulo || 'Sem rótulo'}</span>
                    <Badge variant={agenda.ativa ? 'default' : 'secondary'}>
                      {agenda.ativa ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-md">
                    {agenda.ical_url}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {agenda.ultima_sincronizacao && (
                      <span>
                        Última sync: {new Date(agenda.ultima_sincronizacao).toLocaleString('pt-BR')}
                      </span>
                    )}
                    {eventCounts[agenda.id] !== undefined && (
                      <span>{eventCounts[agenda.id]} evento(s) em cache</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(agenda.id)}
                    disabled={syncingId === agenda.id}
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${syncingId === agenda.id ? 'animate-spin' : ''}`}
                    />
                    {syncingId === agenda.id ? 'Sincronizando...' : 'Sincronizar agora'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(agenda.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
