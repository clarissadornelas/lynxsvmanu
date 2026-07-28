import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useActiveContext } from '@/stores/useActiveContext'
import { useToast } from '@/hooks/use-toast'
import { AGENT_BY_KEY, PLAN_NAME, formatBRL } from '@/lib/constants'

interface CheckoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  onSuccess: () => void
}

export function CheckoutModal({ open, onOpenChange, agentId, onSuccess }: CheckoutModalProps) {
  const { user } = useAuth()
  const { tenantId } = useActiveContext()
  const { toast } = useToast()
  const [coupon, setCoupon] = useState('')
  const [loading, setLoading] = useState(false)

  const agent = AGENT_BY_KEY[agentId]

  const handleCheckout = async () => {
    if (!tenantId || !user?.email || !user?.id) return

    if (!agent) {
      toast({
        title: 'Agente inválido',
        description: `Não foi possível identificar o agente ${agentId}`,
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          tenant_id: tenantId,
          criado_por_email: user.email,
          agente_id: agent.numericId,
          plano: PLAN_NAME,
          valor_mensal: agent.price,
          cupom: coupon.trim() || null,
          status: 'aguardando_pagamento',
        })
        .select()
        .single()

      if (pedidoError) throw pedidoError

      const normalizedCoupon = coupon.trim().toUpperCase()

      if (normalizedCoupon !== 'TESTFREE') {
        toast({ title: 'Pagamento online em breve. Seu pedido ficou registrado.' })
        onOpenChange(false)
        return
      }

      const { data: existing, error: existingError } = await supabase
        .from('acesso_agentes')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('agente_id', agent.numericId)
        .maybeSingle()

      if (existingError) throw existingError

      if (existing) {
        const { error: updateAcesso } = await supabase
          .from('acesso_agentes')
          .update({
            ativo: true,
            plano_contratado: agent.plan,
            valor_mensal: agent.price,
            data_contratacao: new Date().toISOString(),
          })
          .eq('id', existing.id)
        if (updateAcesso) throw updateAcesso
      } else {
        const { error: insertAcesso } = await supabase.from('acesso_agentes').insert({
          tenant_id: tenantId,
          usuario_id: user.id,
          agente_id: agent.numericId,
          plano_contratado: agent.plan,
          valor_mensal: agent.price,
          ativo: true,
          data_contratacao: new Date().toISOString(),
        })
        if (insertAcesso) throw insertAcesso
      }

      const { error: updatePedidoError } = await supabase
        .from('pedidos')
        .update({ status: 'cortesia' })
        .eq('id', pedido.id)

      if (updatePedidoError) {
        toast({
          title: 'Aviso',
          description: 'Access liberado, mas houve um erro ao atualizar o pedido.',
          variant: 'destructive',
        })
      }

      toast({ title: 'Agente liberado com cupom' })
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contratar {agent?.name ?? agentId}</DialogTitle>
          <DialogDescription>
            Plano: {PLAN_NAME} • R$ {agent ? formatBRL(agent.price) : '0,00'}/mês
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="coupon">Cupom de desconto</Label>
            <Input
              id="coupon"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Digite seu cupom"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleCheckout} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Finalizar compra'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
