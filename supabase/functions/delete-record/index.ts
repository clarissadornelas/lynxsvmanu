import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function deleteBy(client: any, table: string, column: string, value: string) {
  const { data, error } = await client.from(table).delete().eq(column, value).select('id')
  if (error) throw new Error(`Erro ao excluir ${table}: ${error.message}`)
  return data?.length ?? 0
}

async function deleteIn(client: any, table: string, column: string, values: string[]) {
  if (values.length === 0) return 0
  const { data, error } = await client.from(table).delete().in(column, values).select('id')
  if (error) throw new Error(`Erro ao excluir ${table}: ${error.message}`)
  return data?.length ?? 0
}

async function insertLog(
  client: any,
  params: {
    tenant_id: string | null
    tipo: 'candidato' | 'vaga'
    registro_id: string
    registro_nome: string | null
    executado_por_id: string | null
    executado_por_email: string | null
    contagens: Record<string, number>
  },
) {
  try {
    const { error } = await client.from('logs_exclusao').insert({
      tenant_id: params.tenant_id,
      tipo: params.tipo,
      registro_id: params.registro_id,
      registro_nome: params.registro_nome,
      executado_por_id: params.executado_por_id,
      executado_por_email: params.executado_por_email,
      contagens: params.contagens,
    })
    if (error) console.error('[logs_exclusao] Insert failed:', error.message)
  } catch (err) {
    console.error('[logs_exclusao] Unexpected error:', err)
  }
}

async function deleteCandidate(
  client: any,
  id: string,
  confirmacao: string,
  operatorId: string | null,
  operatorEmail: string | null,
) {
  const { data: cand, error: fetchErr } = await client
    .from('candidatos')
    .select('id, nome, tenant_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return json({ error: `Erro ao buscar candidato: ${fetchErr.message}` })
  if (!cand) return json({ error: 'Candidato não encontrado' })
  if (confirmacao !== cand.nome)
    return json({ error: 'Confirmação não corresponde ao nome do candidato' })

  const capturedNome = cand.nome
  const capturedTenantId = cand.tenant_id

  const counts: Record<string, number> = {}
  const { data: baseRecords } = await client.from('base_ativa').select('id').eq('candidato_id', id)
  const baseIds = (baseRecords || []).map((b: any) => b.id)

  const { data: convByCand } = await client.from('conversas').select('id').eq('candidato_id', id)
  let convByContato: any[] = []
  if (baseIds.length > 0) {
    const res = await client.from('conversas').select('id').in('contato_id', baseIds)
    convByContato = res.data || []
  }
  const allConvIds = [...new Set([...(convByCand || []), ...convByContato].map((c: any) => c.id))]

  counts.messages = await deleteIn(client, 'mensagens', 'conversa_id', allConvIds)
  counts.conversations = await deleteIn(client, 'conversas', 'id', allConvIds)
  counts.follow_ups = await deleteBy(client, 'follow_ups', 'candidato_id', id)
  counts.interviews = await deleteBy(client, 'entrevistas', 'candidato_id', id)
  counts.appointments = await deleteBy(client, 'agendamentos', 'candidato_id', id)
  counts.candidate_events = await deleteBy(client, 'candidato_eventos', 'candidato_id', id)
  counts.processos = await deleteBy(client, 'processos', 'candidato_id', id)

  if (baseIds.length > 0) {
    await client.from('base_ativa').update({ indicado_por: null }).in('indicado_por', baseIds)
    const { data: delBase, error: baseErr } = await client
      .from('base_ativa')
      .delete()
      .in('id', baseIds)
      .select('id')
    if (baseErr) throw new Error(`Erro ao excluir base_ativa: ${baseErr.message}`)
    counts.base_ativa = delBase?.length ?? 0
  } else {
    counts.base_ativa = 0
  }

  const { error: candErr } = await client.from('candidatos').delete().eq('id', id)
  if (candErr) throw new Error(`Erro ao excluir candidato: ${candErr.message}`)

  await insertLog(client, {
    tenant_id: capturedTenantId,
    tipo: 'candidato',
    registro_id: id,
    registro_nome: capturedNome,
    executado_por_id: operatorId,
    executado_por_email: operatorEmail,
    contagens: counts,
  })

  return json({ success: true, counts })
}

async function deleteJob(
  client: any,
  id: string,
  confirmacao: string,
  operatorId: string | null,
  operatorEmail: string | null,
) {
  const { data: job, error: fetchErr } = await client
    .from('vagas')
    .select('id, titulo, tenant_id, campanha_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return json({ error: `Erro ao buscar vaga: ${fetchErr.message}` })
  if (!job) return json({ error: 'Vaga não encontrada' })
  if (confirmacao !== job.titulo)
    return json({ error: 'Confirmação não corresponde ao título da vaga' })

  const { count, error: countErr } = await client
    .from('candidatos')
    .select('*', { count: 'exact', head: true })
    .eq('vaga_id', id)
  if (countErr) return json({ error: `Erro ao verificar candidatos: ${countErr.message}` })
  if (count && count > 0) return json({ error: `Exclua ou mova os ${count} candidatos antes` })

  if (job.campanha_id) {
    return json({
      error: 'Esta vaga está vinculada a uma campanha. Desvincule a campanha antes de excluir.',
    })
  }

  const capturedTitulo = job.titulo
  const capturedTenantId = job.tenant_id

  const counts: Record<string, number> = {}
  counts.appointments = await deleteBy(client, 'agendamentos', 'vaga_id', id)
  counts.candidate_events = await deleteBy(client, 'candidato_eventos', 'vaga_id', id)
  counts.interviews = await deleteBy(client, 'entrevistas', 'vaga_id', id)

  const { error: jobErr } = await client.from('vagas').delete().eq('id', id)
  if (jobErr) throw new Error(`Erro ao excluir vaga: ${jobErr.message}`)

  await insertLog(client, {
    tenant_id: capturedTenantId,
    tipo: 'vaga',
    registro_id: id,
    registro_nome: capturedTitulo,
    executado_por_id: operatorId,
    executado_por_email: operatorEmail,
    contagens: counts,
  })

  return json({ success: true, counts })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autorizado' }, 401)

    const client = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser()
    if (userError || !user) return json({ error: 'Não autorizado' }, 401)

    const operatorId = user.id
    const operatorEmail = user.email ?? null

    const { tipo, id, confirmacao } = await req.json()
    if (!tipo || !id || !confirmacao) return json({ error: 'Parâmetros inválidos' }, 400)

    if (tipo === 'candidato')
      return await deleteCandidate(client, id, confirmacao, operatorId, operatorEmail)
    if (tipo === 'vaga') return await deleteJob(client, id, confirmacao, operatorId, operatorEmail)
    return json({ error: 'Tipo inválido' }, 400)
  } catch (error: any) {
    return json({ error: error.message || 'Internal Server Error' }, 500)
  }
})
