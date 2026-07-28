import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, Briefcase, User, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { useActiveContext } from '@/stores/useActiveContext'
import { getInitials } from '@/lib/avatar-utils'

interface CandidateResult {
  id: string
  nome: string | null
  foto_url: string | null
}

interface JobResult {
  id: string
  titulo: string
  empresa: string | null
}

interface EmpresaResult {
  empresa: string
}

type SearchResult =
  | { type: 'candidato'; id: string; nome: string | null; foto_url: string | null }
  | { type: 'vaga'; id: string; titulo: string; empresa: string | null }
  | { type: 'empresa'; nome: string }

export function GlobalSearch() {
  const navigate = useNavigate()
  const { tenantId } = useActiveContext()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flatResults = results

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      if (!tenantId) {
        setIsLoading(false)
        return
      }

      const [candRes, vagasRes, empRes] = await Promise.all([
        supabase
          .from('candidatos')
          .select('id, nome, foto_url')
          .eq('tenant_id', tenantId)
          .ilike('nome', `%${query.trim()}%`)
          .limit(5),
        supabase
          .from('vagas')
          .select('id, titulo, empresa')
          .eq('tenant_id', tenantId)
          .ilike('titulo', `%${query.trim()}%`)
          .limit(5),
        supabase
          .from('vagas')
          .select('empresa')
          .eq('tenant_id', tenantId)
          .not('empresa', 'is', null)
          .ilike('empresa', `%${query.trim()}%`)
          .limit(20),
      ])

      const mapped: SearchResult[] = []
      if (candRes.data) {
        for (const c of candRes.data as CandidateResult[]) {
          mapped.push({ type: 'candidato', id: c.id, nome: c.nome, foto_url: c.foto_url })
        }
      }
      if (vagasRes.data) {
        for (const v of vagasRes.data as JobResult[]) {
          mapped.push({ type: 'vaga', id: v.id, titulo: v.titulo, empresa: v.empresa })
        }
      }

      const seenEmpresas = new Set<string>()
      if (empRes.data) {
        for (const e of empRes.data as EmpresaResult[]) {
          const nome = e.empresa?.trim()
          if (nome && !seenEmpresas.has(nome.toLowerCase())) {
            seenEmpresas.add(nome.toLowerCase())
            mapped.push({ type: 'empresa', nome })
          }
          if (seenEmpresas.size >= 5) break
        }
      }

      setResults(mapped)
      setIsLoading(false)
      setIsOpen(true)
      setHighlightedIndex(-1)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, tenantId])

  const handleSelect = useCallback(
    (item: SearchResult) => {
      if (item.type === 'candidato') {
        navigate(`/candidatos/${item.id}`)
      } else if (item.type === 'vaga') {
        navigate(`/vagas/${item.id}`)
      } else {
        navigate(`/vagas?empresa=${encodeURIComponent(item.nome)}`)
      }
      setQuery('')
      setResults([])
      setIsOpen(false)
      setHighlightedIndex(-1)
    },
    [navigate],
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || flatResults.length === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1) % flatResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < flatResults.length) {
        handleSelect(flatResults[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  const candidatos = results.filter((r) => r.type === 'candidato')
  const vagas = results.filter((r) => r.type === 'vaga')
  const empresas = results.filter((r) => r.type === 'empresa')

  return (
    <div ref={containerRef} className="relative hidden md:flex items-center">
      <div className="flex items-center gap-2 bg-slate-100 rounded-full px-4 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 transition-all ml-2">
        <Search className="w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Buscar vagas, candidatos, empresas..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border-0 bg-transparent h-8 w-64 focus-visible:ring-0 px-2 shadow-none"
        />
        {isLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
      </div>

      {isOpen && (
        <div className="absolute top-full left-2 mt-2 w-96 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden animate-fade-in-up">
          {!isLoading && flatResults.length === 0 && query.trim().length >= 2 && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              Nada encontrado para '{query.trim()}'
            </div>
          )}

          {candidatos.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Candidatos
              </div>
              {candidatos.map((item) => {
                const flatIdx = flatResults.indexOf(item)
                return (
                  <div
                    key={`cand-${item.id}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setHighlightedIndex(flatIdx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer',
                      highlightedIndex === flatIdx ? 'bg-indigo-50' : 'hover:bg-slate-50',
                    )}
                  >
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarImage src={item.foto_url || undefined} />
                      <AvatarFallback className="text-xs font-semibold bg-muted">
                        {getInitials(item.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-slate-700 truncate">
                      {item.nome || 'Sem nome'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {vagas.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Vagas
              </div>
              {vagas.map((item) => {
                const flatIdx = flatResults.indexOf(item)
                return (
                  <div
                    key={`vaga-${item.id}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setHighlightedIndex(flatIdx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer',
                      highlightedIndex === flatIdx ? 'bg-indigo-50' : 'hover:bg-slate-50',
                    )}
                  >
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{item.titulo}</p>
                      {item.empresa && (
                        <p className="text-xs text-slate-400 truncate">{item.empresa}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {empresas.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Empresas
              </div>
              {empresas.map((item) => {
                const flatIdx = flatResults.indexOf(item)
                return (
                  <div
                    key={`emp-${item.nome}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setHighlightedIndex(flatIdx)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer',
                      highlightedIndex === flatIdx ? 'bg-indigo-50' : 'hover:bg-slate-50',
                    )}
                  >
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-700 truncate">{item.nome}</span>
                  </div>
                )
              })}
            </div>
          )}

          {flatResults.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3" />
                Use as setas ↑↓ para navegar e Enter para selecionar
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
