import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { getState as getCtxState } from '@/stores/useActiveContext'

interface TenantLinkData {
  id: string
  tenant_id: string
  nome: string
  ativo: boolean
  criado_em: string
  papel: string
  tenants: {
    id: string
    nome: string
    slug: string
  }
}

interface AuthContextType {
  user: User | null
  session: Session | null
  signUp: (
    email: string,
    password: string,
    metadata?: Record<string, any>,
  ) => Promise<{ data: any; error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  loading: boolean
  tenantLinked: boolean | null
  tenantData: TenantLinkData | null
  papelAtivo: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [tenantLinked, setTenantLinked] = useState<boolean | null>(null)
  const [tenantData, setTenantData] = useState<TenantLinkData | null>(null)
  const [papelAtivo, setPapelAtivo] = useState<string | null>(null)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user?.email) {
      setTenantLinked(null)
      setTenantData(null)
      setPapelAtivo(null)
      getCtxState().clear()
      return
    }

    const checkTenantLink = async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, tenant_id, nome, ativo, criado_em, papel, tenants(id, nome, slug)')
        .eq('email', user.email!)
        .eq('ativo', true)
        .order('criado_em', { ascending: true })

      if (error) {
        console.error('[use-auth] Error fetching tenant links:', error)
        setTenantLinked(false)
        setTenantData(null)
        setPapelAtivo(null)
        getCtxState().clear()
        return
      }

      if (!data || data.length === 0) {
        setTenantLinked(false)
        setTenantData(null)
        setPapelAtivo(null)
        getCtxState().clear()
        return
      }

      const links = data as unknown as TenantLinkData[]
      setTenantLinked(true)

      const persistedTenantId = getCtxState().tenantId
      const selectedLink = persistedTenantId
        ? links.find((link) => link.tenant_id === persistedTenantId)
        : null

      const finalLink = selectedLink ?? links[0]

      setTenantData(finalLink)
      setPapelAtivo(finalLink.papel ?? 'usuario')
      getCtxState().setActive(finalLink.tenant_id, finalLink.id)
    }

    checkTenantLink()
  }, [user])

  const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: metadata,
      },
    })
    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    setTenantLinked(null)
    setTenantData(null)
    setPapelAtivo(null)
    getCtxState().clear()
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        signUp,
        signIn,
        signOut,
        loading,
        tenantLinked,
        tenantData,
        papelAtivo,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
