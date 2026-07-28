import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface JobDependencies {
  candidatos: number
  agendamentos: number
  entrevistas: number
}

export function useJobOperations() {
  const [dependencies, setDependencies] = useState<JobDependencies>({
    candidatos: 0,
    agendamentos: 0,
    entrevistas: 0,
  })
  const [loading, setLoading] = useState(false)

  const checkDependencies = useCallback(async (jobId: string) => {
    const [cand, agend, entr] = await Promise.all([
      supabase.from('candidatos').select('id', { count: 'exact' }).eq('vaga_id', jobId),
      supabase.from('agendamentos').select('id', { count: 'exact' }).eq('vaga_id', jobId),
      supabase.from('entrevistas').select('id', { count: 'exact' }).eq('vaga_id', jobId),
    ])
    const deps: JobDependencies = {
      candidatos: cand.count ?? 0,
      agendamentos: agend.count ?? 0,
      entrevistas: entr.count ?? 0,
    }
    setDependencies(deps)
    return deps
  }, [])

  const updateJob = useCallback(async (jobId: string, data: Record<string, unknown>) => {
    setLoading(true)
    const { error } = await supabase.from('vagas').update(data).eq('id', jobId)
    setLoading(false)
    return { error }
  }, [])

  const deleteJob = useCallback(async (jobId: string) => {
    setLoading(true)
    const { error } = await supabase.from('vagas').delete().eq('id', jobId)
    setLoading(false)
    return { error }
  }, [])

  return { dependencies, loading, checkDependencies, updateJob, deleteJob }
}
