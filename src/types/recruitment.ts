import type { Database } from '@/lib/supabase/types'

export type CandidatoRow = Database['public']['Tables']['candidatos']['Row']
export type BaseAtivaRow = Database['public']['Tables']['base_ativa']['Row']
export type VagaRow = Database['public']['Tables']['vagas']['Row']
export type EntrevistaRow = Database['public']['Tables']['entrevistas']['Row']
export type ConversaRow = Database['public']['Tables']['conversas']['Row']

export interface CandidatoWithRelations extends CandidatoRow {
  vagas: { titulo: string } | null
  entrevistas: Pick<EntrevistaRow, 'id' | 'disc'>[]
}

export interface BaseAtivaWithRelations extends BaseAtivaRow {
  candidatos: { foto_url: string | null } | null
}
