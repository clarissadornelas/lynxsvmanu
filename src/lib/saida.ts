import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface EliminarCandidatoParams {
  candidatoId: string
  motivo: string
  statusAtual: string
  vagaId: string
  tenantId: string
  ator?: string
}

export async function eliminarCandidato({
  candidatoId,
  motivo,
  statusAtual,
  vagaId,
  tenantId,
  ator = 'humano',
}: EliminarCandidatoParams): Promise<{ success: boolean; baseAtivaError: boolean }> {
  const { error: updErr } = await supabase
    .from('candidatos')
    .update({
      situacao: 'eliminado',
      motivo_saida: motivo,
      fase_saida: statusAtual,
      situacao_em: new Date().toISOString(),
    })
    .eq('id', candidatoId)

  if (updErr) return { success: false, baseAtivaError: false }

  const { data: candData } = await supabase
    .from('candidatos')
    .select('nome, telefone, email, cargo, tenant_id')
    .eq('id', candidatoId)
    .single()

  let baseAtivaError = false

  if (candData?.telefone) {
    const { data: existingBase } = await supabase
      .from('base_ativa')
      .select('id')
      .eq('candidato_id', candidatoId)
      .maybeSingle()

    if (!existingBase) {
      const { error: baseErr } = await supabase.from('base_ativa').insert({
        candidato_id: candidatoId,
        tenant_id: candData.tenant_id,
        nome: candData.nome,
        telefone: candData.telefone,
        email: candData.email,
        ultimo_cargo: candData.cargo,
        origem: 'saida_processo',
        status_profissional: 'indefinido',
        abertura: 'indefinido',
        consentimento: false,
        opt_out: false,
        lead_quente: false,
        pings_enviados: 0,
        cadencia_dias: 30,
      })

      if (baseErr) baseAtivaError = true
    }
  }

  const { error: evtErr } = await supabase.from('candidato_eventos').insert({
    candidato_id: candidatoId,
    vaga_id: vagaId,
    tenant_id: tenantId || candData?.tenant_id || null,
    tipo: 'saida_processo',
    de: statusAtual,
    para: motivo,
    agente: null,
    ator,
  })

  if (evtErr) console.error(evtErr)

  return { success: true, baseAtivaError }
}
