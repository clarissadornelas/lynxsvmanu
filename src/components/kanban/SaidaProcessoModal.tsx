import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

export type MotivoSaida =
  | 'nao_aprovado'
  | 'desistiu'
  | 'sem_retorno'
  | 'recusou_proposta'
  | 'finalista_nao_escolhido'
  | 'vaga_encerrada'

interface SaidaProcessoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nomeCandidato: string
  permiteRecusouProposta: boolean
  onConfirmar: (motivo: MotivoSaida) => Promise<void>
}

interface OpcaoHumana {
  valor: MotivoSaida
  rotulo: string
  explicacao: string
}

const OPCOES_HUMANAS: OpcaoHumana[] = [
  {
    valor: 'nao_aprovado',
    rotulo: 'Não aprovado',
    explicacao: 'Decisão do recrutador ou do cliente.',
  },
  {
    valor: 'desistiu',
    rotulo: 'Desistiu',
    explicacao: 'A pessoa saiu por conta própria. Alto valor para a Base Ativa.',
  },
  {
    valor: 'recusou_proposta',
    rotulo: 'Recusou proposta',
    explicacao: 'Recebeu oferta e não aceitou. É métrica de negócio.',
  },
]

export function SaidaProcessoModal({
  open,
  onOpenChange,
  nomeCandidato,
  permiteRecusouProposta,
  onConfirmar,
}: SaidaProcessoModalProps) {
  const [motivo, setMotivo] = useState<MotivoSaida | ''>('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (open) {
      setMotivo('')
      setSalvando(false)
    }
  }, [open])

  const opcoesVisiveis = OPCOES_HUMANAS.filter(
    (op) => op.valor !== 'recusou_proposta' || permiteRecusouProposta,
  )

  const handleConfirmar = async () => {
    if (!motivo) return
    setSalvando(true)
    await onConfirmar(motivo as MotivoSaida)
    setSalvando(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tirar do processo</DialogTitle>
          <DialogDescription>
            Selecione o motivo da saída de <span className="font-semibold">{nomeCandidato}</span> do
            processo seletivo.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={motivo}
          onValueChange={(v) => setMotivo(v as MotivoSaida)}
          className="gap-3"
        >
          {opcoesVisiveis.map((opcao) => (
            <div
              key={opcao.valor}
              className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <RadioGroupItem value={opcao.valor} id={opcao.valor} className="mt-1" />
              <div className="flex-1">
                <Label htmlFor={opcao.valor} className="cursor-pointer font-medium">
                  {opcao.rotulo}
                </Label>
                <p className="text-sm text-muted-foreground">{opcao.explicacao}</p>
              </div>
            </div>
          ))}
        </RadioGroup>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!motivo || salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {salvando ? 'Salvando...' : 'Tirar do processo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
