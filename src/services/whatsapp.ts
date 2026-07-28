import { supabase } from '@/lib/supabase/client'
import { getActiveTenantId } from '@/stores/useActiveContext'

export interface WhatsAppConnectResponse {
  instanceName: string
  status: string
  qr: string | null
  isWebhookEnabled: boolean
}

export interface WhatsAppStatusResponse {
  status: string
}

export async function connectWhatsApp(): Promise<{
  data: WhatsAppConnectResponse | null
  error: string | null
}> {
  const tenantId = getActiveTenantId()
  if (!tenantId) return { data: null, error: 'Empresa não informada' }

  const { data, error } = await supabase.functions.invoke('connect-whatsapp', {
    body: { tenantId },
  })
  return { data, error: error?.message ?? null }
}

export async function disconnectWhatsApp(): Promise<{ error: string | null }> {
  const tenantId = getActiveTenantId()
  if (!tenantId) return { error: 'Empresa não informada' }

  const { error } = await supabase.functions.invoke('disconnect-whatsapp', {
    body: { tenantId },
  })
  return { error: error?.message ?? null }
}

export async function getWhatsAppStatus(): Promise<{
  data: WhatsAppStatusResponse | null
  error: string | null
}> {
  const tenantId = getActiveTenantId()
  if (!tenantId) return { data: null, error: 'Empresa não informada' }

  const { data, error } = await supabase.functions.invoke('whatsapp-status', {
    body: { tenantId },
  })
  return { data, error: error?.message ?? null }
}
