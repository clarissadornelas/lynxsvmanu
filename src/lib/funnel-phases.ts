import type { Candidate } from '@/stores/useRecruitmentStore'

export interface FunnelPhase {
  id: 'novo' | 'shortlist' | 'agendado' | 'entrevistado' | 'contratado'
  label: string
  badgeClass: string
  dotClass: string
  textClass: string
  tooltip: string
}

export const FUNNEL_PHASES: FunnelPhase[] = [
  {
    id: 'novo',
    label: 'A Triar',
    badgeClass: 'bg-slate-200 text-slate-700',
    dotClass: 'bg-slate-400',
    textClass: 'text-slate-700',
    tooltip:
      'Candidatos recém-chegados da ingestão de CV, aguardando triagem. Fonte: status do candidato.',
  },
  {
    id: 'shortlist',
    label: 'Longlist',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    dotClass: 'bg-indigo-500',
    textClass: 'text-indigo-700',
    tooltip: 'Aprovados na triagem, elegíveis para contato. Fonte: status do candidato.',
  },
  {
    id: 'agendado',
    label: 'Entrevista agendada',
    badgeClass: 'bg-amber-100 text-amber-700',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700',
    tooltip: 'Rodada de entrevista com dia e hora marcados. Fonte: status do candidato.',
  },
  {
    id: 'entrevistado',
    label: 'Entrevista realizada',
    badgeClass: 'bg-blue-100 text-blue-700',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-700',
    tooltip: 'Rodada realizada, aguardando avaliação do recrutador. Fonte: status do candidato.',
  },
  {
    id: 'contratado',
    label: 'Contratado',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
    tooltip: 'Fecharam a vaga. Fonte: status do candidato.',
  },
]

export function phaseCount(candidates: Candidate[], id: FunnelPhase['id']): number {
  return candidates.filter((c) => c.status === id).length
}

export type KanbanColumnId =
  | 'a_triar'
  | 'longlist'
  | 'em_entrevista'
  | 'entrevistados'
  | 'shortlist_final'
  | 'contratado'

export interface KanbanColumn {
  id: KanbanColumnId
  label: string
  tooltip: string
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'a_triar',
    label: 'A Triar',
    tooltip: 'Candidatos recém-chegados, aguardando triagem.',
  },
  {
    id: 'longlist',
    label: 'Longlist',
    tooltip: 'Aprovados na triagem, elegíveis para contato.',
  },
  {
    id: 'em_entrevista',
    label: 'Em entrevista',
    tooltip: 'Em alguma rodada de entrevista da vaga.',
  },
  {
    id: 'entrevistados',
    label: 'Entrevistados',
    tooltip: 'Completaram todas as rodadas da vaga. Aguardam escolha dos finalistas.',
  },
  {
    id: 'shortlist_final',
    label: 'Shortlist',
    tooltip: 'Finalistas escolhidos entre os entrevistados. É aqui que se decide.',
  },
  {
    id: 'contratado',
    label: 'Contratado',
    tooltip: 'Fechou a vaga.',
  },
]

export interface EtapaVaga {
  n: number
  nome: string
  tipo: string
  agenda_id: string | null
  duracao: number
}

export function parseEtapas(raw: unknown): EtapaVaga[] {
  if (!Array.isArray(raw)) return []
  const parsed = raw
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map(
      (e, i): EtapaVaga => ({
        n: typeof e.n === 'number' ? e.n : i + 1,
        nome: typeof e.nome === 'string' ? e.nome : `Rodada ${i + 1}`,
        tipo: typeof e.tipo === 'string' ? e.tipo : 'rh',
        agenda_id: e.agenda_id == null ? null : String(e.agenda_id),
        duracao: typeof e.duracao === 'number' ? e.duracao : 60,
      }),
    )
  parsed.sort((a, b) => a.n - b.n)
  return parsed
}

export function deriveKanbanColumn(
  status: string,
  etapaAtual: number | null | undefined,
  totalRodadas: number,
  shortlistOrdem?: number | null,
  faseSaida?: string | null,
): KanbanColumnId {
  const efetivo = faseSaida && faseSaida.length > 0 ? faseSaida : status
  if (efetivo === 'contratado') return 'contratado'
  if (typeof shortlistOrdem === 'number' && shortlistOrdem >= 1) return 'shortlist_final'
  if (efetivo === 'novo') return 'a_triar'
  if (efetivo === 'shortlist') return 'longlist'
  if (efetivo === 'agendado' || efetivo === 'entrevistado') {
    const etapa = typeof etapaAtual === 'number' && etapaAtual > 0 ? etapaAtual : 1
    if (totalRodadas > 0 && etapa > totalRodadas) return 'entrevistados'
    return 'em_entrevista'
  }
  return 'a_triar'
}

export const COLUNA_PARA_STATUS: Record<KanbanColumnId, string | null> = {
  a_triar: 'novo',
  longlist: 'shortlist',
  em_entrevista: 'agendado',
  entrevistados: null,
  shortlist_final: null,
  contratado: 'contratado',
}

export function statusDaColuna(colId: KanbanColumnId): string | null {
  return COLUNA_PARA_STATUS[colId] ?? null
}

export interface CopilotStage {
  id: 'a_preparar' | 'pronta' | 'a_analisar' | 'analisada'
  label: string
  badgeClass: string
  dotClass: string
  textClass: string
  hint: string
}

export const COPILOT_STAGES: CopilotStage[] = [
  {
    id: 'a_preparar',
    label: 'A Preparar',
    badgeClass: 'bg-amber-100 text-amber-700',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700',
    hint: 'agendados sem roteiro',
  },
  {
    id: 'pronta',
    label: 'Prontas',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    dotClass: 'bg-indigo-500',
    textClass: 'text-indigo-700',
    hint: 'roteiro pronto, aguardando',
  },
  {
    id: 'a_analisar',
    label: 'A Analisar',
    badgeClass: 'bg-blue-100 text-blue-700',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-700',
    hint: 'realizadas sem transcrição',
  },
  {
    id: 'analisada',
    label: 'Analisadas',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
    hint: 'prontas pra decisão',
  },
]

const STATUS_LABELS: Record<string, string> = {
  novo: 'A Triar',
  shortlist: 'Longlist',
  agendado: 'Agendado',
  em_teste: 'Em experiência',
  entrevistado: 'Entrevistado',
  contratado: 'Contratado',
  descartado: 'Descartado',
  reprovado: 'Reprovado',
  inativo: 'Inativo',
}

export function rotuloStatus(status: string | null | undefined): string {
  if (!status) return '—'
  return STATUS_LABELS[status] ?? status
}

const EVENTO_LABELS: Record<string, string> = {
  mudanca_status: 'Mudança de fase',
  mudanca_fase: 'Mudança de fase',
  status_alterado: 'Mudança de fase',
  contato_inicial: 'Contato inicial',
  rodada_criada: 'Rodada criada',
  conversa_encerrada: 'Conversa encerrada',
  criacao: 'Criação',
  mensagem_enviada: 'Mensagem enviada',
  mensagem_recebida: 'Mensagem recebida',
  agendamento: 'Agendamento',
  entrevista: 'Entrevista',
  follow_up: 'Follow-up',
  note_added: 'Nota adicionada',
}

export function rotuloEvento(tipo: string | null | undefined): string {
  if (!tipo) return 'Evento'
  return EVENTO_LABELS[tipo] ?? tipo.replace(/_/g, ' ')
}

export function deriveCopilotStage(
  interview: any | null | undefined,
  activeAppointment: any | null | undefined,
): CopilotStage['id'] {
  if (interview) {
    if (interview.status === 'analisada' || interview.status === 'entregue') {
      return 'analisada'
    }
    if (interview.status === 'roteiro_pronto') {
      return 'pronta'
    }
    if (interview.status === 'realizada' || interview.status === 'em_analise') {
      return 'a_analisar'
    }
    if (interview.status === 'aguardando') {
      return 'a_preparar'
    }
  }
  if (activeAppointment) {
    return 'a_preparar'
  }
  return 'a_preparar'
}

export interface GrupoRodada<T> {
  n: number
  nome: string
  tipo: string
  itens: T[]
}

export function agruparPorRodada<T extends { etapaAtual: number }>(
  itens: T[],
  etapas: EtapaVaga[],
): GrupoRodada<T>[] {
  if (!etapas || etapas.length === 0) {
    return [{ n: 1, nome: 'Entrevista', tipo: 'rh', itens: [...itens] }]
  }
  return etapas.map((etapa) => ({
    n: etapa.n,
    nome: etapa.nome,
    tipo: etapa.tipo,
    itens: itens.filter((item) => {
      const etapaAtual =
        typeof item.etapaAtual === 'number' && item.etapaAtual > 0 ? item.etapaAtual : 1
      return etapaAtual === etapa.n
    }),
  }))
}

export function recuoRodada(indice: number): number {
  return indice * 14
}

export interface PassoRampa {
  borda: string
  fundo: string
  texto: string
}

export const RAMPA_RODADA: PassoRampa[] = [
  { borda: 'hsl(154 40% 78%)', fundo: 'hsl(154 40% 97%)', texto: 'hsl(165 60% 22%)' },
  { borda: 'hsl(157 45% 62%)', fundo: 'hsl(157 42% 95%)', texto: 'hsl(165 60% 20%)' },
  { borda: 'hsl(160 55% 44%)', fundo: 'hsl(160 45% 94%)', texto: 'hsl(165 65% 18%)' },
  { borda: 'hsl(165 75% 28%)', fundo: 'hsl(165 40% 93%)', texto: 'hsl(165 70% 15%)' },
]

export function classesRodada(indice: number, total: number): PassoRampa {
  if (total <= 1) return RAMPA_RODADA[0]
  const ratio = Math.max(0, Math.min(1, indice / (total - 1)))
  const scaled = ratio * (RAMPA_RODADA.length - 1)
  const i = Math.floor(scaled)
  return RAMPA_RODADA[Math.min(i, RAMPA_RODADA.length - 1)]
}

export function classesRodadaAntiga(
  indice: number,
  total: number,
): { borda: string; fundo: string; texto: string } {
  const presets = RAMPA_RODADA

  if (total <= 1) {
    return presets[0]
  }

  const ratio = Math.max(0, Math.min(1, indice / (total - 1)))
  const scaled = ratio * (presets.length - 1)
  const i = Math.floor(scaled)
  return presets[Math.min(i, presets.length - 1)]
}

export type MotivoSaida =
  | 'nao_aprovado'
  | 'desistiu'
  | 'sem_retorno'
  | 'recusou_proposta'
  | 'finalista_nao_escolhido'
  | 'vaga_encerrada'

export interface OpcaoMotivoSaida {
  valor: MotivoSaida
  rotulo: string
  explicacao: string
}

export const MOTIVOS_SAIDA_HUMANOS: OpcaoMotivoSaida[] = [
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

const MOTIVO_SAIDA_LABELS: Record<MotivoSaida, string> = {
  nao_aprovado: 'Não aprovado',
  desistiu: 'Desistiu',
  sem_retorno: 'Sem retorno',
  recusou_proposta: 'Recusou proposta',
  finalista_nao_escolhido: 'Finalista não escolhido',
  vaga_encerrada: 'Vaga encerrada',
}

export function rotuloMotivoSaida(motivo: string | null | undefined): string {
  if (!motivo) return '—'
  if (motivo in MOTIVO_SAIDA_LABELS) {
    return MOTIVO_SAIDA_LABELS[motivo as MotivoSaida]
  }
  return motivo.replace(/_/g, ' ')
}

export const COR_FASE: Record<KanbanColumnId, string> = {
  a_triar: 'hsl(276 15% 82%)',
  longlist: 'hsl(197 60% 68%)',
  em_entrevista: 'hsl(157 45% 62%)',
  entrevistados: 'hsl(165 75% 28%)',
  shortlist_final: 'hsl(276 33% 30%)',
  contratado: 'hsl(43 84% 45%)',
}

export type NotaAvaliacao = 1 | 2 | 3 | 4

export interface OpcaoNota {
  valor: NotaAvaliacao
  rotulo: string
}

export const NOTAS_AVALIACAO: OpcaoNota[] = [
  { valor: 1, rotulo: 'Não atendeu' },
  { valor: 2, rotulo: 'Parcial' },
  { valor: 3, rotulo: 'Atendeu' },
  { valor: 4, rotulo: 'Superou' },
]

export function rotuloNota(valor: number | null | undefined): string {
  if (valor == null) return '—'
  const opcao = NOTAS_AVALIACAO.find((n) => n.valor === valor)
  return opcao ? opcao.rotulo : '—'
}

export type TipoPergunta = 'fechada' | 'aberta'

export type EscopoPergunta = 'casa' | 'vaga' | 'candidato'

const ORDEM_ESCOPO: Record<EscopoPergunta, number> = {
  casa: 0,
  vaga: 1,
  candidato: 2,
}

export interface PerguntaEtapa {
  id: string
  texto: string
  tipo: TipoPergunta
  escopo: EscopoPergunta
  editada?: boolean
}

interface RawPergunta {
  id?: unknown
  texto?: unknown
  tipo?: unknown
  escopo?: unknown
}

export function normalizarPergunta(raw: Record<string, unknown>): PerguntaEtapa {
  const escopoRaw = typeof raw.escopo === 'string' ? raw.escopo : 'casa'
  const escopo: EscopoPergunta =
    escopoRaw === 'vaga' || escopoRaw === 'candidato' ? escopoRaw : 'casa'
  const tipoRaw = typeof raw.tipo === 'string' ? raw.tipo : 'aberta'
  const tipo: TipoPergunta =
    escopo === 'candidato' ? 'aberta' : tipoRaw === 'fechada' ? 'fechada' : 'aberta'
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    texto: typeof raw.texto === 'string' ? raw.texto : '',
    tipo,
    escopo,
  }
}

export function parsePerguntas(raw: unknown): PerguntaEtapa[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => normalizarPergunta(item))
}

export function resolverPerguntas(casa: PerguntaEtapa[], vaga: PerguntaEtapa[]): PerguntaEtapa[] {
  const vagaById = new Map<string, PerguntaEtapa>()
  for (const p of vaga) {
    vagaById.set(p.id, p)
  }

  const result: PerguntaEtapa[] = []

  for (const pCasa of casa) {
    const override = vagaById.get(pCasa.id)
    if (override) {
      result.push({
        id: pCasa.id,
        texto: override.texto,
        tipo: pCasa.tipo,
        escopo: 'casa',
        editada: override.texto !== pCasa.texto,
      })
      vagaById.delete(pCasa.id)
    } else {
      result.push({ ...pCasa })
    }
  }

  for (const pVaga of vagaById.values()) {
    result.push({ ...pVaga })
  }

  result.sort((a, b) => ORDEM_ESCOPO[a.escopo] - ORDEM_ESCOPO[b.escopo])
  return result
}

export type EstadoResposta = 'avaliada' | 'aberta'

export interface RespostaAvaliacao {
  pergunta_id: string
  texto: string
  tipo: TipoPergunta
  nota: NotaAvaliacao | null
  resposta_texto: string | null
  estado: EstadoResposta
}

export interface AvaliacaoEntrevista {
  respostas: RespostaAvaliacao[]
  observacoes: string | null
}

interface RawResposta {
  pergunta_id?: unknown
  texto?: unknown
  tipo?: unknown
  nota?: unknown
  resposta_texto?: unknown
}

export function parseAvaliacao(raw: unknown): AvaliacaoEntrevista | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.respostas)) return null

  const respostas: RespostaAvaliacao[] = obj.respostas
    .filter((r): r is RawResposta => typeof r === 'object' && r !== null)
    .map((r) => {
      const notaRaw = typeof r.nota === 'number' ? r.nota : null
      const nota: NotaAvaliacao | null =
        notaRaw !== null && notaRaw >= 1 && notaRaw <= 4 ? (notaRaw as NotaAvaliacao) : null
      const tipoRaw = typeof r.tipo === 'string' ? r.tipo : 'aberta'
      const tipo: TipoPergunta = tipoRaw === 'fechada' ? 'fechada' : 'aberta'
      return {
        pergunta_id: typeof r.pergunta_id === 'string' ? r.pergunta_id : '',
        texto: typeof r.texto === 'string' ? r.texto : '',
        tipo,
        nota,
        resposta_texto: typeof r.resposta_texto === 'string' ? r.resposta_texto : null,
        estado: nota !== null ? 'avaliada' : 'aberta',
      }
    })

  return {
    respostas,
    observacoes: typeof obj.observacoes === 'string' ? obj.observacoes : null,
  }
}

export function montarAvaliacaoVazia(perguntas: PerguntaEtapa[]): AvaliacaoEntrevista {
  const respostas: RespostaAvaliacao[] = perguntas.map((p) => ({
    pergunta_id: p.id,
    texto: p.texto,
    tipo: p.tipo,
    nota: null,
    resposta_texto: null,
    estado: 'aberta' as EstadoResposta,
  }))
  return {
    respostas,
    observacoes: null,
  }
}

export interface ResultadoCobertura {
  media: number | null
  respondidas: number
  fechadas: number
}

export function notaECobertura(avaliacao: AvaliacaoEntrevista | null): ResultadoCobertura {
  if (!avaliacao) return { media: null, respondidas: 0, fechadas: 0 }
  const fechadas = avaliacao.respostas.filter((r) => r.tipo === 'fechada')
  const respondidas = fechadas.filter((r) => r.nota !== null)
  if (respondidas.length === 0) {
    return { media: null, respondidas: 0, fechadas: fechadas.length }
  }
  const soma = respondidas.reduce((acc, r) => acc + (r.nota ?? 0), 0)
  return {
    media: soma / respondidas.length,
    respondidas: respondidas.length,
    fechadas: fechadas.length,
  }
}

export function formatarNotaCobertura(cobertura: ResultadoCobertura): string {
  const mediaStr =
    cobertura.media === null
      ? 'sem nota'
      : cobertura.media.toLocaleString('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        })
  return `${mediaStr} · ${cobertura.respondidas} de ${cobertura.fechadas}`
}

export type TipoRodada = 'rh' | 'tecnica' | 'gestor' | 'cultural' | 'prova'

export interface OpcaoTipoRodada {
  valor: TipoRodada
  rotulo: string
  descricao: string
}

export const TIPOS_RODADA: OpcaoTipoRodada[] = [
  {
    valor: 'rh',
    rotulo: 'RH',
    descricao: 'Entrevista comportamental e de alinhamento inicial com o recrutador.',
  },
  {
    valor: 'tecnica',
    rotulo: 'Técnica',
    descricao: 'Avaliação de conhecimentos técnicos específicos para a vaga.',
  },
  {
    valor: 'gestor',
    rotulo: 'Gestor',
    descricao: 'Entrevista com o gestor direto da área contratante.',
  },
  {
    valor: 'cultural',
    rotulo: 'Cultural',
    descricao: 'Avaliação de fit cultural e alinhamento de valores com a empresa.',
  },
  {
    valor: 'prova',
    rotulo: 'Prova técnica',
    descricao: 'Resolução de um caso prático ou prova técnica estruturada.',
  },
]

export function rotuloTipoRodada(valor: string): string {
  const opcao = TIPOS_RODADA.find((t) => t.valor === valor)
  return opcao ? opcao.rotulo : 'RH'
}

export function tipoRodadaValido(valor: string): TipoRodada {
  const opcao = TIPOS_RODADA.find((t) => t.valor === valor)
  return opcao ? opcao.valor : 'rh'
}

export type EstadoRodada = 'sem_agenda' | 'com_agenda' | 'realizada' | 'avaliada' | 'dispensada'

export const ESTADO_RODADA_LABELS: Record<EstadoRodada, string> = {
  sem_agenda: 'sem agenda',
  com_agenda: 'agendado',
  realizada: 'realizada',
  avaliada: 'avaliada',
  dispensada: 'dispensada',
}

export function rotuloEstadoRodada(estado: string): string {
  if (estado in ESTADO_RODADA_LABELS) {
    return ESTADO_RODADA_LABELS[estado as EstadoRodada]
  }
  return 'sem agenda'
}

export interface CoberturaDeRodadas {
  avaliadas: number
  dispensadas: number
  totalRodadas: number
}

export function formatarCoberturaDeRodadas(cobertura: CoberturaDeRodadas): string {
  if (cobertura.totalRodadas <= 1 && cobertura.dispensadas > 0) {
    return 'rodada dispensada'
  }
  if (cobertura.dispensadas === 0) {
    return ''
  }
  return `${cobertura.avaliadas} de ${cobertura.totalRodadas} avaliadas`
}

export type AgentType = 'assessor' | 'copiloto' | 'base_ativa'

export type ColunaEntitlement = 'ag1_assessor' | 'ag2_copiloto' | 'ag3_ativador'

export interface DefinicaoAgente {
  agentType: AgentType
  id: string
  nome: string
  descricao: string
  rota: string
  cor: string
  colunaEntitlement: ColunaEntitlement
  rotuloMetrica: string
}

export const CTA_CONTRATAR_SEM_PERMISSAO = 'Fale com o administrador para ativar'

export function agenteContratado(idsContratados: string[], agentType: string): boolean {
  const def = definicaoAgente(agentType)
  if (!def) return false
  return idsContratados.includes(def.id)
}

export const AGENTES: DefinicaoAgente[] = [
  {
    agentType: 'assessor',
    id: '01',
    nome: 'Meu Assessor',
    descricao:
      'Mande os currículos pelo WhatsApp. O assessor entra em contato com cada candidato e faz os agendamentos.',
    rota: '/agente-01',
    cor: '#457B9D',
    colunaEntitlement: 'ag1_assessor',
    rotuloMetrica: 'em processo',
  },
  {
    agentType: 'copiloto',
    id: '02',
    nome: 'Copiloto',
    descricao: 'Transcrição de entrevistas, avaliação estruturada e leitura comportamental.',
    rota: '/agente-02',
    cor: '#06A77D',
    colunaEntitlement: 'ag2_copiloto',
    rotuloMetrica: 'entrevistas',
  },
  {
    agentType: 'base_ativa',
    id: '03',
    nome: 'Base Ativa',
    descricao:
      'O candidato que não deu match hoje vale ouro amanhã. Banco de talentos com follow-up periódico.',
    rota: '/agente-03',
    cor: '#F77F00',
    colunaEntitlement: 'ag3_ativador',
    rotuloMetrica: 'talentos',
  },
]

export function definicaoAgente(agentType: string): DefinicaoAgente | null {
  return AGENTES.find((a) => a.agentType === agentType) ?? null
}

export function agenteAtivo(
  entitlements: Record<string, unknown> | null | undefined,
  agentType: string,
): boolean {
  if (!entitlements) return false
  const def = definicaoAgente(agentType)
  if (!def) return false
  return entitlements[def.colunaEntitlement] === true
}
