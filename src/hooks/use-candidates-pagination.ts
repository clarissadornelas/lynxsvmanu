import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { CandidatoWithRelations } from '@/types/recruitment'
import { toast } from 'sonner'

const PAGE_SIZE = 20

export interface JobOption {
  id: string
  titulo: string
  count: number
}

export function useCandidatesPagination(tenantId: string | null) {
  const [candidates, setCandidates] = useState<CandidatoWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedPhases, setSelectedPhases] = useState<Set<string>>(new Set())
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set())
  const [phaseCounts, setPhaseCounts] = useState<Record<string, number>>({})
  const [jobOptions, setJobOptions] = useState<JobOption[]>([])
  const pageRef = useRef(0)

  useEffect(() => {
    if (!tenantId) {
      setCandidates([])
      setLoading(false)
      return
    }
    let cancelled = false
    const timer = setTimeout(
      async () => {
        setLoading(true)
        try {
          let query = supabase
            .from('candidatos')
            .select('*, vagas(titulo), entrevistas(id, disc)', { count: 'exact' })
            .eq('tenant_id', tenantId)
            .order('criado_em', { ascending: false })
          if (search.trim()) query = query.ilike('nome', `%${search.trim()}%`)
          if (selectedPhases.size > 0) query = query.in('status', Array.from(selectedPhases))
          if (selectedJobs.size > 0) query = query.in('vaga_id', Array.from(selectedJobs))
          const { data, error, count } = await query.range(0, PAGE_SIZE - 1)
          if (error) throw error
          if (!cancelled) {
            const rows = (data || []) as CandidatoWithRelations[]
            setCandidates(rows)
            setTotalCount(count ?? 0)
            setHasMore(rows.length === PAGE_SIZE)
            pageRef.current = 0
          }
        } catch {
          if (!cancelled) {
            toast.error('Erro ao carregar candidatos. Tente novamente.')
            setCandidates([])
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      },
      search ? 400 : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tenantId, search, selectedPhases, selectedJobs])

  const loadMore = async () => {
    if (loadingMore || !hasMore || !tenantId) return
    setLoadingMore(true)
    try {
      let query = supabase
        .from('candidatos')
        .select('*, vagas(titulo), entrevistas(id, disc)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('criado_em', { ascending: false })
      if (search.trim()) query = query.ilike('nome', `%${search.trim()}%`)
      if (selectedPhases.size > 0) query = query.in('status', Array.from(selectedPhases))
      if (selectedJobs.size > 0) query = query.in('vaga_id', Array.from(selectedJobs))
      const next = pageRef.current + 1
      const { data, error } = await query.range(next * PAGE_SIZE, (next + 1) * PAGE_SIZE - 1)
      if (error) throw error
      const rows = (data || []) as CandidatoWithRelations[]
      setCandidates((prev) => [...prev, ...rows])
      setHasMore(rows.length === PAGE_SIZE)
      pageRef.current = next
    } catch {
      toast.error('Erro ao carregar mais candidatos.')
    } finally {
      setLoadingMore(false)
    }
  }

  const loadMetadata = async () => {
    if (!tenantId) return
    try {
      const { data, error } = await supabase
        .from('candidatos')
        .select('id, status, vaga_id, vagas(titulo)')
        .eq('tenant_id', tenantId)
      if (error) throw error
      const counts: Record<string, number> = {}
      const jobMap = new Map<string, JobOption>()
      for (const c of data || []) {
        counts[c.status] = (counts[c.status] || 0) + 1
        if (c.vaga_id) {
          const ex = jobMap.get(c.vaga_id)
          if (ex) ex.count++
          else
            jobMap.set(c.vaga_id, {
              id: c.vaga_id,
              titulo: c.vagas?.titulo || 'Sem vaga',
              count: 1,
            })
        }
      }
      setPhaseCounts(counts)
      setJobOptions(Array.from(jobMap.values()).sort((a, b) => b.count - a.count))
    } catch {
      // Silent fail for metadata
    }
  }

  useEffect(() => {
    if (tenantId) loadMetadata()
  }, [tenantId])

  const updateLocalCandidate = (id: string, updates: Partial<CandidatoWithRelations>) => {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  const togglePhase = (phaseId: string) => {
    setSelectedPhases((prev) => {
      const next = new Set(prev)
      if (next.has(phaseId)) next.delete(phaseId)
      else next.add(phaseId)
      return next
    })
  }

  const toggleJob = (jobId: string) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  const clearFilters = () => {
    setSelectedPhases(new Set())
    setSelectedJobs(new Set())
  }

  return {
    candidates,
    loading,
    loadingMore,
    totalCount,
    hasMore,
    loadMore,
    search,
    setSearch,
    selectedPhases,
    selectedJobs,
    togglePhase,
    toggleJob,
    clearFilters,
    phaseCounts,
    jobOptions,
    updateLocalCandidate,
    refreshMetadata: loadMetadata,
  }
}
