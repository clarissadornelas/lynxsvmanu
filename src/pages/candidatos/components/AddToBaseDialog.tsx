import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { UserPlus, Loader2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CADENCE_OPTIONS = [7, 15, 30, 60, 90]
const SENTIMENT_OPTIONS = ['positivo', 'neutro', 'atencao', 'risco']

interface AddToBaseDialogProps {
  candidatoId: string
  nome?: string | null
  email?: string | null
  telefone?: string | null
  empresaAtual?: string | null
  ultimoCargo?: string | null
  tenantId: string | null
  alreadyInBase?: boolean
  onSuccess?: () => void
  triggerVariant?: 'card' | 'profile'
}

export function AddToBaseDialog({
  candidatoId,
  nome,
  email,
  telefone,
  empresaAtual,
  ultimoCargo,
  tenantId,
  alreadyInBase = false,
  onSuccess,
  triggerVariant = 'card',
}: AddToBaseDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [consent, setConsent] = useState(false)
  const [cadence, setCadence] = useState('30')
  const [leadQuente, setLeadQuente] = useState(false)
  const [formNome, setFormNome] = useState(nome || '')
  const [formTelefone, setFormTelefone] = useState(telefone || '')
  const [formEmail, setFormEmail] = useState(email || '')
  const [formEmpresa, setFormEmpresa] = useState(empresaAtual || '')
  const [formCargo, setFormCargo] = useState(ultimoCargo || '')
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [checkingDup, setCheckingDup] = useState(false)
  const [contatoAte, setContatoAte] = useState('')
  const [orientacaoAgente, setOrientacaoAgente] = useState('')
  const [contextoRelacionamento, setContextoRelacionamento] = useState('')
  const [sentimento, setSentimento] = useState('neutro')

  useEffect(() => {
    if (open) {
      setConsent(false)
      setCadence('30')
      setLeadQuente(false)
      setFormNome(nome || '')
      setFormTelefone(telefone || '')
      setFormEmail(email || '')
      setFormEmpresa(empresaAtual || '')
      setFormCargo(ultimoCargo || '')
      setIsDuplicate(alreadyInBase)
      setContatoAte('')
      setOrientacaoAgente('')
      setContextoRelacionamento('')
      setSentimento('neutro')
      if (!alreadyInBase) {
        setCheckingDup(true)
        supabase
          .from('base_ativa')
          .select('id')
          .eq('candidato_id', candidatoId)
          .maybeSingle()
          .then(({ data }) => {
            setIsDuplicate(!!data)
            setCheckingDup(false)
          })
      }
    }
  }, [open, candidatoId, alreadyInBase, nome, telefone, email, empresaAtual, ultimoCargo])

  const canSubmit = consent && formTelefone.trim().length > 0 && !isDuplicate && !checkingDup

  const handleAddToBase = async () => {
    if (!tenantId) {
      toast.error('Tenant não encontrado. Selecione uma conta ativa.')
      return
    }
    if (!formTelefone.trim()) {
      toast.error('Telefone é obrigatório.')
      return
    }
    setLoading(true)
    const { error: insertError } = await supabase.from('base_ativa').insert({
      candidato_id: candidatoId,
      nome: formNome || null,
      email: formEmail || null,
      telefone: formTelefone.trim(),
      empresa_atual: formEmpresa || null,
      ultimo_cargo: formCargo || null,
      origem: 'funil',
      tenant_id: tenantId,
      status_profissional: 'indefinido',
      abertura: 'indefinido',
      consentimento: true,
      consentimento_em: new Date().toISOString(),
      cadencia_dias: parseInt(cadence),
      lead_quente: leadQuente,
      contato_ate: contatoAte || null,
      orientacao_agente: orientacaoAgente || null,
      contexto_relacionamento: contextoRelacionamento || null,
      sentimento: sentimento || null,
    })
    if (insertError) {
      toast.error('Erro ao incluir na Base Ativa: ' + insertError.message)
      setLoading(false)
      return
    }
    const { error: eventError } = await supabase.from('candidato_eventos').insert({
      candidato_id: candidatoId,
      tenant_id: tenantId,
      tipo: 'incluido_base_ativa',
      agente: 'base_ativa',
      ator: 'operador',
      payload: {
        cadencia_dias: parseInt(cadence),
        sentimento,
        contato_ate: contatoAte || null,
      },
    })
    if (eventError) {
      toast.error('Erro ao registrar evento de inclusão: ' + eventError.message)
      setLoading(false)
      return
    }
    toast.success(
      `${formNome || 'Candidato'} incluído na Base Ativa · follow-up a cada ${cadence}d`,
    )
    setLoading(false)
    setOpen(false)
    onSuccess?.()
  }

  if (alreadyInBase) {
    return triggerVariant === 'card' ? (
      <Badge variant="secondary" className="w-full justify-center text-xs py-1.5">
        Na Base Ativa
      </Badge>
    ) : (
      <Badge variant="secondary" className="w-full justify-center py-2">
        Na Base Ativa
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerVariant === 'card' ? (
          <Button variant="outline" size="sm" className="w-full text-xs">
            <UserPlus className="w-3.5 h-3.5 mr-1" /> Incluir na Base Ativa
          </Button>
        ) : (
          <Button
            className="w-full justify-start text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
            variant="secondary"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Incluir na Base Ativa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Incluir na Base Ativa</DialogTitle>
          <DialogDescription>
            Inclua <span className="font-semibold text-slate-700">{nome || 'este candidato'}</span>{' '}
            na Base Ativa para follow-up automatizado contínuo.
          </DialogDescription>
        </DialogHeader>
        {isDuplicate ? (
          <div className="py-6 flex flex-col items-center text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-500" />
            <p className="font-semibold text-slate-700">Já está na Base Ativa</p>
            <p className="text-sm text-muted-foreground">
              Este candidato já foi incluído na Base Ativa anteriormente.
            </p>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <>
            <div className="py-2 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">
                  Telefone <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formTelefone}
                  onChange={(e) => setFormTelefone(e.target.value)}
                  placeholder="Telefone é obrigatório"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Email</Label>
                <Input
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Empresa atual</Label>
                  <Input
                    value={formEmpresa}
                    onChange={(e) => setFormEmpresa(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Último cargo</Label>
                  <Input
                    value={formCargo}
                    onChange={(e) => setFormCargo(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Cadência de follow-up</Label>
                <Select value={cadence} onValueChange={setCadence}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CADENCE_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        A cada {d} dias
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Contexto do Relacionamento
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Prazo de contato</Label>
                    <Input
                      type="date"
                      value={contatoAte}
                      onChange={(e) => setContatoAte(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Sentimento</Label>
                    <Select value={sentimento} onValueChange={setSentimento}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SENTIMENT_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Orientação para o Agente</Label>
                  <Textarea
                    placeholder="Instruções específicas para o AI..."
                    rows={2}
                    value={orientacaoAgente}
                    onChange={(e) => setOrientacaoAgente(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Contexto do Relacionamento</Label>
                  <Textarea
                    placeholder="Dossiê histórico do vínculo..."
                    rows={2}
                    value={contextoRelacionamento}
                    onChange={(e) => setContextoRelacionamento(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-xs font-medium">Lead quente</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Marcar como prioridade de contato
                  </p>
                </div>
                <Switch checked={leadQuente} onCheckedChange={setLeadQuente} />
              </div>
              <div className="flex items-start gap-2 rounded-lg border p-3 bg-slate-50">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="consent" className="text-xs leading-relaxed cursor-pointer">
                  Tenho consentimento deste candidato para contato contínuo de relacionamento
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleAddToBase} disabled={!canSubmit || loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Incluindo...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" /> Incluir
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
