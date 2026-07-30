import type { CandidateStatus } from '@/stores/useRecruitmentStore'

interface Lane {
  key: string
  label: string
  statuses: string[]
  color: string
}

export const STATUS_COLORS: Record<string, string> = {
  novo: '#C4E2D7',
  shortlist: '#5DCAA5',
  agendado: '#0F6E56',
  em_teste: '#B6B0EE',
  entrevistado: '#534AB7',
  contratado: '#BA7517',
  descartado: '#8A8980',
  reprovado: '#A32D2D',
  inativo: '#6B7280',
}

export const LANES: Lane[] = [
  {
    key: 'assessor',
    label: 'Assessor',
    statuses: ['novo', 'shortlist', 'agendado'],
    color: '#0F6E56',
  },
  { key: 'copiloto', label: 'Copiloto', statuses: ['entrevistado'], color: '#534AB7' },
  { key: 'base_viva', label: 'Base Viva', statuses: ['contratado'], color: '#BA7517' },
  { key: 'saidas', label: 'Saídas', statuses: ['descartado', 'reprovado'], color: '#8A8980' },
]

export const NEXT_STEPS: Record<CandidateStatus, string> = {
  novo: 'Mover p/ shortlist',
  shortlist: 'Mover p/ agendado',
  agendado: 'Iniciar Copiloto',
  em_teste: 'Ver entrevista',
  entrevistado: 'Ver resumo',
  contratado: 'Ver perfil',
  descartado: 'Ver perfil',
  reprovado: 'Ver perfil',
  inativo: 'Reativar',
}
