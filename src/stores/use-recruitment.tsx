import React, { createContext, useContext, useState, ReactNode } from 'react'

export type Job = { id: string; title: string; company: string; status: 'active' | 'closed' }
export type CandidateStatus = 'analise' | 'aprovado' | 'abordagem' | 'agendado'
export type Candidate = {
  id: string
  jobId: string
  name: string
  email: string
  phone: string
  matchScore: number
  scores: { experience: number; technical: number; cultural: number; seniority: number }
  status: CandidateStatus
  skills: string[]
}
export type Interaction = {
  id: string
  candidateId: string
  type: 'whatsapp' | 'email' | 'system'
  message: string
  date: string
}

interface RecruitmentContextType {
  jobs: Job[]
  candidates: Candidate[]
  interactions: Interaction[]
  addJob: (job: Job) => void
  addCandidates: (candidates: Candidate[]) => void
  updateCandidateStatus: (id: string, status: CandidateStatus) => void
  addInteraction: (interaction: Interaction) => void
}

const mockJobs: Job[] = [
  { id: 'j1', title: 'Engenheiro Frontend Sênior', company: 'TechCorp Brasil', status: 'active' },
]
const mockCandidates: Candidate[] = [
  {
    id: 'c1',
    jobId: 'j1',
    name: 'João Silva',
    email: 'joao@ex.com',
    phone: '11999999999',
    matchScore: 92,
    scores: { experience: 90, technical: 95, cultural: 85, seniority: 98 },
    status: 'analise',
    skills: ['React', 'TypeScript', 'Tailwind'],
  },
  {
    id: 'c2',
    jobId: 'j1',
    name: 'Maria Oliveira',
    email: 'maria@ex.com',
    phone: '11888888888',
    matchScore: 88,
    scores: { experience: 85, technical: 80, cultural: 95, seniority: 90 },
    status: 'aprovado',
    skills: ['Vue', 'JavaScript', 'CSS'],
  },
  {
    id: 'c3',
    jobId: 'j1',
    name: 'Carlos Souza',
    email: 'carlos@ex.com',
    phone: '11777777777',
    matchScore: 95,
    scores: { experience: 95, technical: 98, cultural: 90, seniority: 95 },
    status: 'agendado',
    skills: ['React', 'Node.js', 'AWS'],
  },
  {
    id: 'c4',
    jobId: 'j1',
    name: 'Ana Costa',
    email: 'ana@ex.com',
    phone: '11666666666',
    matchScore: 78,
    scores: { experience: 75, technical: 70, cultural: 80, seniority: 85 },
    status: 'abordagem',
    skills: ['Angular', 'TypeScript'],
  },
]
const mockInteractions: Interaction[] = [
  {
    id: 'i1',
    candidateId: 'c4',
    type: 'whatsapp',
    message: 'Oi Ana, tudo bem? Vimos seu perfil...',
    date: new Date().toISOString(),
  },
]

const RecruitmentContext = createContext<RecruitmentContextType | null>(null)

export function RecruitmentProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(mockJobs)
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates)
  const [interactions, setInteractions] = useState<Interaction[]>(mockInteractions)

  const addJob = (job: Job) => setJobs((prev) => [...prev, job])
  const addCandidates = (newCands: Candidate[]) => setCandidates((prev) => [...prev, ...newCands])
  const updateCandidateStatus = (id: string, status: CandidateStatus) => {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
  }
  const addInteraction = (interaction: Interaction) =>
    setInteractions((prev) => [interaction, ...prev])

  return (
    <RecruitmentContext.Provider
      value={{
        jobs,
        candidates,
        interactions,
        addJob,
        addCandidates,
        updateCandidateStatus,
        addInteraction,
      }}
    >
      {children}
    </RecruitmentContext.Provider>
  )
}

export const useRecruitment = () => {
  const context = useContext(RecruitmentContext)
  if (!context) throw new Error('useRecruitment must be used within a RecruitmentProvider')
  return context
}
