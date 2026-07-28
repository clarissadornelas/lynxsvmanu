import { createClient } from 'jsr:@supabase/supabase-js@2'

export interface TenantAuthResult {
  ok: boolean
  status: number
  error?: string
  user?: any
  tenantId?: string
  supabase?: any
}

export async function verifyTenantAccess(
  supabaseUrl: string,
  serviceRoleKey: string,
  authHeader: string | null,
  tenantId: string | undefined,
  requireAdmin: boolean,
): Promise<TenantAuthResult> {
  if (!authHeader) {
    return { ok: false, status: 401, error: 'Missing Authorization header' }
  }

  if (!tenantId) {
    return { ok: false, status: 400, error: 'Empresa não informada' }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id, papel')
    .eq('email', user.email!)
    .eq('tenant_id', tenantId)
    .eq('ativo', true)
    .maybeSingle()

  if (usuarioError) {
    return { ok: false, status: 500, error: 'Erro ao verificar vínculo: ' + usuarioError.message }
  }

  if (!usuario) {
    return { ok: false, status: 403, error: 'Sem vínculo ativo com esta empresa' }
  }

  if (requireAdmin && usuario.papel !== 'admin') {
    return {
      ok: false,
      status: 403,
      error: 'Apenas administradores conectam o WhatsApp da empresa',
    }
  }

  return { ok: true, status: 200, user, tenantId, supabase }
}
