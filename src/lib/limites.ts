import { supabase } from '@/lib/supabase/client'

export type DimensaoLimite = 'membros' | 'vagas_abertas' | 'base_ativa' | 'entrevistas_mes'

export const LIMITES_POR_PLANO: Record<DimensaoLimite, number | null> = {
  membros: null,
  vagas_abertas: null,
  base_ativa: null,
  entrevistas_mes: null,
}

export interface UsoEmpresa {
  membros: number
  vagas_abertas: number
  base_ativa: number
  entrevistas_mes: number
}

export interface ResultadoLimite {
  permitido: boolean
  usoAtual: number
  limite: number | null
}

async function contarMembros(tenantId: string): Promise<number> {
  const { count, error } = await supabase
    .from('usuarios')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('ativo', true)
  if (error) {
    console.error('[limites] Erro ao contar membros:', error)
    return 0
  }
  return count ?? 0
}

async function contarVagasAbertas(tenantId: string): Promise<number> {
  const { count, error } = await supabase
    .from('vagas')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('status', 'aberta')
  if (error) {
    console.error('[limites] Erro ao contar vagas abertas:', error)
    return 0
  }
  return count ?? 0
}

async function contarBaseAtiva(tenantId: string): Promise<number> {
  const { count, error } = await supabase
    .from('base_ativa')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('opt_out', false)
  if (error) {
    console.error('[limites] Erro ao contar base ativa:', error)
    return 0
  }
  return count ?? 0
}

async function contarEntrevistasMes(tenantId: string): Promise<number> {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const { count, error } = await supabase
    .from('entrevistas')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .gte('criado_em', firstDay.toISOString())
  if (error) {
    console.error('[limites] Erro ao contar entrevistas do mês:', error)
    return 0
  }
  return count ?? 0
}

const CONTADORES: Record<DimensaoLimite, (tenantId: string) => Promise<number>> = {
  membros: contarMembros,
  vagas_abertas: contarVagasAbertas,
  base_ativa: contarBaseAtiva,
  entrevistas_mes: contarEntrevistasMes,
}

export async function buscarUsoEmpresa(tenantId: string): Promise<UsoEmpresa> {
  const [membros, vagas_abertas, base_ativa, entrevistas_mes] = await Promise.all([
    contarMembros(tenantId),
    contarVagasAbertas(tenantId),
    contarBaseAtiva(tenantId),
    contarEntrevistasMes(tenantId),
  ])
  return { membros, vagas_abertas, base_ativa, entrevistas_mes }
}

export async function verificarLimite(
  tenantId: string,
  dimensao: DimensaoLimite,
): Promise<ResultadoLimite> {
  const limite = LIMITES_POR_PLANO[dimensao]
  const usoAtual = await CONTADORES[dimensao](tenantId)
  const permitido = limite === null ? true : usoAtual < limite
  return { permitido, usoAtual, limite }
}
