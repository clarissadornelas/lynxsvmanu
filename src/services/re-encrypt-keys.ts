import { supabase } from '@/lib/supabase/client'

export interface ReEncryptResult {
  total: number
  re_encrypted: number
  failed: number
  details: { id: string; provider: string; status: string; error?: string }[]
}

export const reEncryptKeys = async () => {
  const { data, error } = await supabase.functions.invoke('re-encrypt-keys')
  return { data: data as ReEncryptResult | null, error }
}
