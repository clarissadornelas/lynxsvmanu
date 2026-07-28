import { useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface ActiveContextState {
  tenantId: string | null
  usuarioId: string | null
  setActive: (tenantId: string, usuarioId: string | null) => void
  clear: () => void
}

const STORAGE_KEY = 'active-context'

let state: ActiveContextState = {
  tenantId: null,
  usuarioId: null,
  setActive: (tenantId: string, usuarioId: string | null) => {
    setState({ tenantId, usuarioId })
  },
  clear: () => {
    setState({ tenantId: null, usuarioId: null })
  },
}

const listeners = new Set<() => void>()

function setState(next: { tenantId: string | null; usuarioId: string | null }) {
  state = {
    ...state,
    tenantId: next.tenantId,
    usuarioId: next.usuarioId,
  }
  if (state.tenantId) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tenantId: state.tenantId, usuarioId: state.usuarioId }),
    )
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
  listeners.forEach((l) => l())
}

export function getState(): ActiveContextState {
  return state
}

export function getActiveTenantId(): string | null {
  return state.tenantId
}

export async function initActiveContext(): Promise<void> {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (parsed.tenantId) {
        state = {
          ...state,
          tenantId: parsed.tenantId,
          usuarioId: parsed.usuarioId ?? null,
        }
        listeners.forEach((l) => l())
        return
      }
    } catch {
      // fall through to query
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const email = session?.user?.email
  if (!email) return

  const { data } = await supabase
    .from('usuarios')
    .select('tenant_id, id')
    .eq('email', email)
    .eq('ativo', true)
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (data) {
    setState({ tenantId: data.tenant_id, usuarioId: data.id })
  }
}

export function useActiveContext(): ActiveContextState {
  return useSyncExternalStore(
    (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => state,
    () => state,
  )
}

export default useActiveContext
