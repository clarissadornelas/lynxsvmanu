import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useActiveContext } from '@/stores/useActiveContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Send, CheckCircle2, MessageSquare } from 'lucide-react'
import { CHAMADO_STATUS_STYLES, CHAMADO_STATUS_LABELS } from '@/lib/constants'

const CATEGORIAS = [
  { value: 'duvida', label: 'Dúvida' },
  { value: 'problema', label: 'Problema' },
  { value: 'sugestao', label: 'Sugestão' },
  { value: 'financeiro', label: 'Financeiro' },
]

interface Chamado {
  id: string
  criado_em: string
  assunto: string
  status: string
}

export default function Contato() {
  const { user } = useAuth()
  const { tenantId } = useActiveContext()
  const { toast } = useToast()
  const [assunto, setAssunto] = useState('')
  const [categoria, setCategoria] = useState('duvida')
  const [mensagem, setMensagem] = useState('')
  const [loading, setLoading] = useState(false)
  const [protocol, setProtocol] = useState<string | null>(null)
  const [tickets, setTickets] = useState<Chamado[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)

  const loadTickets = useCallback(async () => {
    if (!tenantId || !user?.email) {
      setTicketsLoading(false)
      return
    }
    const { data } = await supabase
      .from('chamados')
      .select('id, criado_em, assunto, status')
      .eq('tenant_id', tenantId)
      .eq('criado_por_email', user.email)
      .order('criado_em', { ascending: false })
    setTickets((data as Chamado[]) || [])
    setTicketsLoading(false)
  }, [tenantId, user?.email])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const handleSubmit = async () => {
    if (!tenantId || !user?.email || !assunto.trim() || !mensagem.trim()) return
    setLoading(true)
    const { data, error } = await supabase
      .from('chamados')
      .insert({
        tenant_id: tenantId,
        criado_por_email: user.email,
        assunto: assunto.trim(),
        categoria,
        mensagem: mensagem.trim(),
      })
      .select('id')
      .single()

    if (error) {
      toast({ title: 'Erro ao abrir chamado', description: error.message, variant: 'destructive' })
      setLoading(false)
      return
    }

    setProtocol(data.id.substring(0, 8))
    setAssunto('')
    setCategoria('duvida')
    setMensagem('')
    setLoading(false)
    loadTickets()
  }

  const canSubmit = assunto.trim().length > 0 && mensagem.trim().length > 0 && !loading

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Contato</h1>
        <p className="text-sm text-slate-500 mt-1">Abra um chamado e nossa equipe vai te ajudar</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo chamado</CardTitle>
        </CardHeader>
        <CardContent>
          {protocol ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <p className="text-base font-medium text-slate-900">
                Chamado #{protocol} aberto. Nossa equipe vai analisar e retornar.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setProtocol(null)}>
                Abrir outro chamado
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assunto">Assunto</Label>
                <Input
                  id="assunto"
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  maxLength={120}
                  placeholder="Resuma o seu chamado"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger id="categoria">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mensagem">Mensagem</Label>
                  <span className="text-xs text-slate-400">{mensagem.length}/2000</span>
                </div>
                <Textarea
                  id="mensagem"
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  placeholder="Descreva detalhadamente o seu chamado"
                />
              </div>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Abrir chamado
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seus chamados</CardTitle>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Nenhum chamado aberto.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{t.assunto}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(t.criado_em).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Badge className={CHAMADO_STATUS_STYLES[t.status] || 'bg-gray-100 text-gray-600'}>
                    {CHAMADO_STATUS_LABELS[t.status] || t.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
