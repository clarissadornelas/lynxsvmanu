import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MOTIVOS_SAIDA_HUMANOS, type MotivoSaida } from '@/lib/funnel-phases'

interface SaidaProcessoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nomeCandidato: string
  permiteRecusouProposta: boolean
  onConfirmar: (motivo: MotivoSaida) => Promise<void>
}

export type { MotivoSaida }

export default function SaidaProcessoModal({
  open,
  onOpenChange,
  nomeCandidato,
  permiteRecusouProposta,
  onConfirmar,
}: SaidaProcessoModalProps) {
  const [motivo, setMotivo] = useState<MotivoSaida | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (open) {
      setMotivo(null)
      setSalvando(false)
    }
  }, [open])

  const opcoesVisiveis = MOTIVOS_SAIDA_HUMANOS.filter(
    (opcao) => opcao.valor !== 'recusou_proposta' || permiteRecusouProposta,
  )

  const handleConfirmar = async () => {
    if (!motivo || salvando) return
    setSalvando(true)
    try {
      await onConfirmar(motivo)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tirar {nomeCandidato} do processo</DialogTitle>
          <DialogDescription>
            O motivo é obrigatório. A pessoa continua visível no rodapé da fase onde saiu, e passa a
            fazer parte da Base Ativa.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2">
          {opcoesVisiveis.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => setMotivo(opcao.valor)}
              className={`w-full text-left rounded-md border px-4 py-3 text-sm transition-colors ${
                motivo === opcao.valor
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              <span className="block text-sm font-medium text-slate-900">{opcao.rotulo}</span>
              <span className="block text-xs text-slate-500 mt-0.5">{opcao.explicacao}</span>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!motivo || salvando}>
            {salvando ? 'Salvando...' : 'Tirar do processo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
