import { supabase } from '@/lib/supabase/client'
import { eliminarCandidato } from '@/lib/saida'

export type DecisaoRodada = 'avancou' | 'shortlist' | 'nao_passou' | 'encerrada'

export interface ResultadoDecisao {
  success: boolean
  eventoOk: boolean
  ordem?: number | null
  erro?: string
}

export interface AvancarRodadaParams {
  candidatoId: string
  vagaId: string
  tenantId: string
  entrevistaId: string | null
  rodadaAtual: number
  proximaRodada: number
  totalEtapas?: number
  semParecer?: boolean
  ator?: string
}

export interface ShortlistParams {
  candidatoId: string
  vagaId: string
  tenantId: string
  entrevistaId: string | null
  statusAtual: string
  semParecer?: boolean
  ator?: string
}

export interface NaoPassarParams {
  candidatoId: string
  vagaId: string
  tenantId: string
  entrevistaId: string | null
  statusAtual: string
  motivo: string
  semParecer?: boolean
  ator?: string
}

export interface EncerrarRodadaParams {
  entrevistaId: string | null
  semParecer?: boolean
}

async function carimbarDecisao(
  entrevistaId: string | null,
  decisao: DecisaoRodada,
  semParecer: boolean,
): Promise<void> {
  if (!entrevistaId) return

  const { error } = await supabase
    .from('entrevistas')
    .update({
      decisao,
      decisao_em: new Date().toISOString(),
      decisao_sem_parecer: semParecer,
    })
    .eq('id', entrevistaId)

  if (error) console.error('carimbarDecisao', error)
}

export async function avancarRodada(params: AvancarRodadaParams): Promise<ResultadoDecisao> {
  const {
    candidatoId,
    vagaId,
    tenantId,
    entrevistaId,
    rodadaAtual,
    proximaRodada,
    totalEtapas,
    semParecer = false,
    ator = 'avaliacao',
  } = params

  const encerrouFunil = typeof totalEtapas === 'number' && proximaRodada > totalEtapas

  const { error: candErr } = await supabase
    .from('candidatos')
    .update({ etapa_atual: proximaRodada })
    .eq('id', candidatoId)

  if (candErr) {
    return { success: false, eventoOk: false, erro: candErr.message }
  }

  const { error: evtErr } = await supabase.from('candidato_eventos').insert({
    candidato_id: candidatoId,
    vaga_id: vagaId,
    tenant_id: tenantId,
    tipo: 'rodada_criada',
    de: String(rodadaAtual),
    para: String(proximaRodada),
    agente: null,
    ator,
  })

  await carimbarDecisao(entrevistaId, 'avancou', semParecer)

  const { data: jaExiste } = await supabase
    .from('entrevistas')
    .select('id')
    .eq('candidato_id', candidatoId)
    .eq('vaga_id', vagaId)
    .eq('rodada', proximaRodada)
    .maybeSingle()

  let entrevistaCriadaErro: string | undefined
  // proximaRodada beyond totalEtapas is a control number (totalEtapas + 1), not a real stage.
  // It moves the candidate to "Entrevistados" via deriveKanbanColumn — there is no interview
  // to create. Creating one would generate a ghost record in the dossier.
  if (!jaExiste && !encerrouFunil) {
    const { error: novaErr } = await supabase.from('entrevistas').insert({
      tenant_id: tenantId,
      vaga_id: vagaId,
      candidato_id: candidatoId,
      rodada: proximaRodada,
      status: 'aguardando',
    })
    if (novaErr) entrevistaCriadaErro = novaErr.message
  }

  return {
    success: true,
    eventoOk: !evtErr,
    erro: evtErr?.message || entrevistaCriadaErro,
  }
}

export async function mandarParaShortlist(params: ShortlistParams): Promise<ResultadoDecisao> {
  const {
    candidatoId,
    vagaId,
    tenantId,
    entrevistaId,
    statusAtual,
    semParecer = false,
    ator = 'avaliacao',
  } = params

  const { data: maxRow } = await supabase
    .from('candidatos')
    .select('shortlist_ordem')
    .eq('vaga_id', vagaId)
    .not('shortlist_ordem', 'is', null)
    .order('shortlist_ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const proximaOrdem = (maxRow?.shortlist_ordem ?? 0) + 1

  const { error: updErr } = await supabase
    .from('candidatos')
    .update({ shortlist_ordem: proximaOrdem })
    .eq('id', candidatoId)

  if (updErr) {
    return { success: false, eventoOk: false, ordem: null, erro: updErr.message }
  }

  const { error: evtErr } = await supabase.from('candidato_eventos').insert({
    candidato_id: candidatoId,
    vaga_id: vagaId,
    tenant_id: tenantId,
    tipo: 'mudanca_fase',
    de: statusAtual,
    para: 'shortlist',
    agente: null,
    ator,
  })

  await carimbarDecisao(entrevistaId, 'shortlist', semParecer)

  return { success: true, eventoOk: !evtErr, ordem: proximaOrdem, erro: evtErr?.message }
}

export async function naoPassar(
  params: NaoPassarParams,
): Promise<ResultadoDecisao & { baseAtivaError?: boolean }> {
  const {
    candidatoId,
    vagaId,
    tenantId,
    entrevistaId,
    statusAtual,
    motivo,
    semParecer = false,
    ator = 'avaliacao',
  } = params

  const resultado = await eliminarCandidato({
    candidatoId,
    motivo,
    statusAtual,
    vagaId,
    tenantId,
    ator,
  })

  if (!resultado.success) {
    return {
      success: false,
      eventoOk: false,
      baseAtivaError: resultado.baseAtivaError,
      erro: 'Nao foi possivel registrar a saida do candidato.',
    }
  }

  await carimbarDecisao(entrevistaId, 'nao_passou', semParecer)

  return { success: true, eventoOk: true, baseAtivaError: resultado.baseAtivaError }
}

export async function encerrarRodadaSemDecisao(
  params: EncerrarRodadaParams,
): Promise<ResultadoDecisao> {
  const { entrevistaId, semParecer = false } = params

  await carimbarDecisao(entrevistaId, 'encerrada', semParecer)

  return { success: true, eventoOk: true }
}
