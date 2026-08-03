export type EixoDisc = 'D' | 'I' | 'S' | 'C'

export const EIXOS_DISC: EixoDisc[] = ['D', 'I', 'S', 'C']

export const LIMITE_DIVERGENCIA = 25

export const PESO_SEM_CONFIANCA = 0.5

export interface DiscDaRodada {
  rodada: number
  etapaNome: string
  D: number | null
  I: number | null
  S: number | null
  C: number | null
  perfil: string | null
  confianca: number | null
}

export interface DivergenciaEixo {
  eixo: EixoDisc
  variacao: number
  rodadaMaior: string
  valorMaior: number
  rodadaMenor: string
  valorMenor: number
  frase: string
}

export interface DiscConsolidado {
  D: number
  I: number
  S: number
  C: number
  perfil: string
  rodadas: number
  confiancaMedia: number
  divergencias: DivergenciaEixo[]
  selo: string
}

function numeroOuNulo(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string') {
    const n = Number(valor)
    if (Number.isFinite(n)) return n
  }
  return null
}

export function parseDiscDaRodada(
  raw: unknown,
  rodada: number,
  etapaNome: string,
): DiscDaRodada | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const fonte =
    obj.detalhes && typeof obj.detalhes === 'object'
      ? (obj.detalhes as Record<string, unknown>)
      : obj

  const D = numeroOuNulo(fonte.D)
  const I = numeroOuNulo(fonte.I)
  const S = numeroOuNulo(fonte.S)
  const C = numeroOuNulo(fonte.C)

  if (D === null && I === null && S === null && C === null) return null

  const perfilRaw = obj.profile ?? obj.perfil
  const confiancaRaw = numeroOuNulo(obj.confidence ?? obj.confianca)

  return {
    rodada,
    etapaNome,
    D,
    I,
    S,
    C,
    perfil: typeof perfilRaw === 'string' && perfilRaw.length > 0 ? perfilRaw : null,
    confianca: confiancaRaw === null ? null : Math.min(1, Math.max(0, confiancaRaw)),
  }
}

function pesoDa(rodada: DiscDaRodada): number {
  if (rodada.confianca === null) return PESO_SEM_CONFIANCA
  if (rodada.confianca <= 0) return PESO_SEM_CONFIANCA
  return rodada.confianca
}

function mediaPonderada(rodadas: DiscDaRodada[], eixo: EixoDisc): number | null {
  let soma = 0
  let pesos = 0
  for (const r of rodadas) {
    const valor = r[eixo]
    if (valor === null) continue
    const peso = pesoDa(r)
    soma += valor * peso
    pesos += peso
  }
  if (pesos === 0) return null
  return Math.round(soma / pesos)
}

function perfilDosEixos(valores: Record<EixoDisc, number>): string {
  const ordenados = [...EIXOS_DISC].sort((a, b) => {
    const diff = valores[b] - valores[a]
    if (diff !== 0) return diff
    return a.localeCompare(b)
  })
  return ordenados.slice(0, 2).join('')
}

function calcularDivergencias(rodadas: DiscDaRodada[]): DivergenciaEixo[] {
  if (rodadas.length < 2) return []
  const achados: DivergenciaEixo[] = []

  for (const eixo of EIXOS_DISC) {
    const comValor = rodadas.filter((r) => r[eixo] !== null)
    if (comValor.length < 2) continue

    let maior = comValor[0]
    let menor = comValor[0]
    for (const r of comValor) {
      if ((r[eixo] as number) > (maior[eixo] as number)) maior = r
      if ((r[eixo] as number) < (menor[eixo] as number)) menor = r
    }

    const valorMaior = maior[eixo] as number
    const valorMenor = menor[eixo] as number
    const variacao = valorMaior - valorMenor
    if (variacao <= LIMITE_DIVERGENCIA) continue

    achados.push({
      eixo,
      variacao,
      rodadaMaior: maior.etapaNome,
      valorMaior,
      rodadaMenor: menor.etapaNome,
      valorMenor,
      frase: `O eixo ${eixo} variou ${variacao} pontos entre as rodadas: ${valorMaior} em ${maior.etapaNome} e ${valorMenor} em ${menor.etapaNome}.`,
    })
  }

  achados.sort((a, b) => b.variacao - a.variacao)
  return achados
}

export function consolidarDisc(rodadas: DiscDaRodada[]): DiscConsolidado | null {
  const validas = rodadas.filter(
    (r) => r.D !== null || r.I !== null || r.S !== null || r.C !== null,
  )
  if (validas.length === 0) return null

  const medias: Partial<Record<EixoDisc, number>> = {}
  for (const eixo of EIXOS_DISC) {
    const m = mediaPonderada(validas, eixo)
    if (m === null) return null
    medias[eixo] = m
  }

  const completos = medias as Record<EixoDisc, number>
  const somaConfianca = validas.reduce((acc, r) => acc + pesoDa(r), 0)

  return {
    D: completos.D,
    I: completos.I,
    S: completos.S,
    C: completos.C,
    perfil: perfilDosEixos(completos),
    rodadas: validas.length,
    confiancaMedia: Math.round((somaConfianca / validas.length) * 100) / 100,
    divergencias: calcularDivergencias(validas),
    selo: validas.length === 1 ? 'baseado em 1 rodada' : `baseado em ${validas.length} rodadas`,
  }
}
