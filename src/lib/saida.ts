import { supabase } from '@/lib/supabase/client'
import { type MotivoSaida } from '@/lib/funnel-phases'

export interface ResultadoSaida {
  ok: boolean
  avisoBaseAtiva: boolean
  erro: string | null
}

export async function eliminarCandidato(params: {
  candidatoId: string
  statusAtual: string
  motivo: MotivoSaida
  vagaId: string
  tenantId: string
  ator: string
}): Promise<ResultadoSaida> {
  const { candidatoId, statusAtual, motivo, vagaId, tenantId, ator } = params

  const { error: updErr } = await supabase
    .from('candidatos')
    .update({
      situacao: 'eliminado',
      motivo_saida: motivo,
      fase_saida: statusAtual,
      situacao_em: new Date().toISOString(),
    })
    .eq('id', candidatoId)

  if (updErr) {
    return { ok: false, avisoBaseAtiva: false, erro: updErr.message }
  }

  let avisoBaseAtiva = false

  const { data: candData } = await supabase
    .from('candidatos')
    .select('nome, telefone, email, cargo, tenant_id')
    .eq('id', candidatoId)
    .single()

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

      if (baseErr) {
        avisoBaseAtiva = true
      }
    }
  }

  const { error: evtErr } = await supabase.from('candidato_eventos').insert({
    candidato_id: candidatoId,
    vaga_id: vagaId,
    tenant_id: tenantId,
    tipo: 'saida_processo',
    de: statusAtual,
    para: motivo,
    agente: null,
    ator,
  })

  if (evtErr) {
    console.error(evtErr)
  }

  return { ok: true, avisoBaseAtiva, erro: null }
}
