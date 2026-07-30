import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decrypt } from '../_shared/crypto.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

interface AcaoAgente {
  id: string
  tenant_id: string
  agent_type: string
  tipo_acao: string
  candidato_id: string | null
  vaga_id: string | null
  agendada_para: string | null
  status: string
  texto_composto: string | null
  motivo: string | null
  resultado: string | null
}

interface AgentConfig {
  id: string
  tenant_id: string
  agent_type: string | null
  modo: string
  ativo: boolean
  nome_agente: string | null
  tom: string | null
  tom_detalhe: string | null
  mensagem_apresentacao: string | null
  criterios_cv: string | null
  criterios_entrevista: string | null
  dias_sem_resposta: number | null
  cadencia_follow_up_dias: number | null
  prompt_disc: string | null
  prompt_disc_versao: number
}

async function getApiKey(tenantId: string): Promise<string | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase
    .from('ai_provider_keys')
    .select('api_key_encrypted')
    .eq('tenant_id', tenantId)
    .eq('provider', 'openai')
    .maybeSingle()

  if (error || !data?.api_key_encrypted) {
    return null
  }

  try {
    return await decrypt(data.api_key_encrypted)
  } catch {
    return null
  }
}

async function classifyMessage(
  apiKey: string,
  candidateMessage: string,
): Promise<{ tipo: string; justificativa: string }> {
  const systemPrompt = `Você é um classificador de mensagens de candidatos. Analise a mensagem do candidato e classifique em uma destas categorias:
- "confirmar": O candidato confirma interesse ou disponibilidade para entrevista/vaga
- "reagendar": O candidato pede para reagendar ou sugere outro horário
- "sair": O candidato pede para não receber mais mensagens, desistir, ou remover da base (opt-out)
- "pergunta": O candidato faz uma pergunta sobre a vaga, processo, ou empresa
- "outro": Qualquer outra mensagem que não se encaixe nas categorias acima

Responda APENAS em formato JSON com os campos "tipo" e "justificativa".`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: candidateMessage },
      ],
    }),
  })

  if (!response.ok) {
    return { tipo: 'outro', justificativa: `Erro na API: ${response.status}` }
  }

  const json = await response.json()
  const content = json.choices?.[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(content)
  return {
    tipo: parsed.tipo ?? 'outro',
    justificativa: parsed.justificativa ?? '',
  }
}

async function composeMessage(
  apiKey: string,
  systemPrompt: string,
  context: string,
): Promise<string | null> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context },
      ],
    }),
  })

  if (!response.ok) {
    return null
  }

  const json = await response.json()
  return json.choices?.[0]?.message?.content ?? null
}

async function dispatchWhatsApp(
  tenantId: string,
  candidateId: string | null,
  baseId: string | null,
  phone: string,
  message: string,
  contexto: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        candidateId,
        baseId,
        phone,
        message,
        contexto,
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

async function updateBaseAtivaEngagement(tenantId: string, candidateId: string): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  await supabase
    .from('base_ativa')
    .update({
      pings_enviados: (await supabase
        .from('base_ativa')
        .select('pings_enviados')
        .eq('tenant_id', tenantId)
        .eq('candidato_id', candidateId)
        .maybeSingle()
        .then((r) => (r.data?.pings_enviados ?? 0) + 1)) as number,
      ultimo_ping_em: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('candidato_id', candidateId)
}

async function handleResponderCandidato(
  supabase: ReturnType<typeof createClient>,
  acao: AcaoAgente,
  apiKey: string,
  config: AgentConfig,
): Promise<{ success: boolean; resultado: string }> {
  if (!acao.candidato_id) {
    return { success: false, resultado: 'Candidato não informado' }
  }

  const { data: candidato } = await supabase
    .from('candidatos')
    .select('nome, telefone, opt_out, vaga_id')
    .eq('id', acao.candidato_id)
    .single()

  if (!candidato) {
    return { success: false, resultado: 'Candidato não encontrado' }
  }

  if (candidato.opt_out) {
    return { success: false, resultado: 'Candidato em opt-out' }
  }

  const { data: conversa } = await supabase
    .from('conversas')
    .select('id')
    .eq('candidato_id', acao.candidato_id)
    .order('ultima_interacao', { ascending: false })
    .limit(1)
    .maybeSingle()

  let ultimaMensagemCandidato = ''

  if (conversa) {
    const { data: msgs } = await supabase
      .from('mensagens')
      .select('conteudo, direcao')
      .eq('conversa_id', conversa.id)
      .order('criado_em', { ascending: false })
      .limit(5)

    if (msgs) {
      const candidataMsgs = msgs.filter((m) => m.direcao === 'entrada')
      if (candidataMsgs.length > 0) {
        ultimaMensagemCandidato = candidataMsgs[0].conteudo
      }
    }
  }

  let tipoResposta = 'outro'

  if (ultimaMensagemCandidato && apiKey) {
    const classificacao = await classifyMessage(apiKey, ultimaMensagemCandidato)
    tipoResposta = classificacao.tipo

    if (tipoResposta === 'sair') {
      await supabase
        .from('candidatos')
        .update({
          opt_out: true,
          opt_out_em: new Date().toISOString(),
        })
        .eq('id', acao.candidato_id)

      await supabase
        .from('base_ativa')
        .update({
          opt_out: true,
          opt_out_em: new Date().toISOString(),
        })
        .eq('tenant_id', acao.tenant_id)
        .eq('candidato_id', acao.candidato_id)

      await supabase.from('acoes_agente').insert({
        tenant_id: acao.tenant_id,
        agent_type: acao.agent_type,
        tipo_acao: 'notificar_operador',
        candidato_id: acao.candidato_id,
        vaga_id: acao.vaga_id,
        agendada_para: new Date().toISOString(),
        status: 'pendente',
        texto_composto: `Opt-out solicitado por ${candidato.nome}`,
        motivo: 'Candidato solicitou cancelamento de mensagens',
      })

      return {
        success: true,
        resultado: `Opt-out registrado para ${candidato.nome}. Operador notificado.`,
      }
    }

    if (tipoResposta === 'reagendar') {
      await supabase.from('acoes_agente').insert({
        tenant_id: acao.tenant_id,
        agent_type: acao.agent_type,
        tipo_acao: 'escalar',
        candidato_id: acao.candidato_id,
        vaga_id: acao.vaga_id,
        agendada_para: new Date().toISOString(),
        status: 'pendente',
        texto_composto: `Reagendamento solicitado por ${candidato.nome}`,
        motivo: 'Candidato solicitou reagendamento de entrevista',
        motivo_escalacao: 'reagendamento_solicitado',
      })

      return {
        success: true,
        resultado: `Reagendamento escalado para ${candidato.nome}`,
      }
    }
  }

  const systemPrompt =
    config.mensagem_apresentacao ||
    `Você é um assistente de recrutamento. Tom: ${config.tom || 'profissional'}. ${config.tom_detalhe || ''}. Gere uma mensagem curta e cordial para o candidato.`

  const context = `Candidato: ${candidato.nome}
Ação: ${acao.tipo_acao}
Motivo: ${acao.motivo || ''}
Última mensagem do candidato: ${ultimaMensagemCandidato || 'Nenhuma'}
Tipo de resposta detectado: ${tipoResposta}`

  let messageToSend = acao.texto_composto

  if (!messageToSend && apiKey) {
    const composed = await composeMessage(apiKey, systemPrompt, context)
    if (composed) {
      messageToSend = composed
    }
  }

  if (!messageToSend) {
    messageToSend = `Olá ${candidato.nome || ''}, tudo bem?`
  }

  if (!candidato.telefone) {
    return { success: false, resultado: 'Candidato sem telefone' }
  }

  const { data: baseAtiva } = await supabase
    .from('base_ativa')
    .select('id')
    .eq('tenant_id', acao.tenant_id)
    .eq('candidato_id', acao.candidato_id)
    .maybeSingle()

  const dispatched = await dispatchWhatsApp(
    acao.tenant_id,
    acao.candidato_id,
    baseAtiva?.id ?? null,
    candidato.telefone,
    messageToSend,
    acao.agent_type,
  )

  if (dispatched) {
    await updateBaseAtivaEngagement(acao.tenant_id, acao.candidato_id)
  }

  if (tipoResposta === 'confirmar') {
    await supabase.from('candidatos').update({ status: 'confirmado' }).eq('id', acao.candidato_id)
  }

  if (tipoResposta === 'pergunta' || tipoResposta === 'outro') {
    await supabase.from('acoes_agente').insert({
      tenant_id: acao.tenant_id,
      agent_type: acao.agent_type,
      tipo_acao: 'escalar',
      candidato_id: acao.candidato_id,
      vaga_id: acao.vaga_id,
      agendada_para: new Date().toISOString(),
      status: 'pendente',
      texto_composto: `Mensagem ambígua de ${candidato.nome}`,
      motivo: `Tipo detectado: ${tipoResposta}. Requer atenção humana.`,
      motivo_escalacao: 'mensagem_ambigua',
    })

    return {
      success: true,
      resultado: `Mensagem ambígua (${tipoResposta}) escalada para ${candidato.nome}`,
    }
  }

  return {
    success: dispatched,
    resultado: dispatched
      ? `Mensagem enviada para ${candidato.nome} (tipo: ${tipoResposta})`
      : 'Falha no envio da mensagem',
  }
}

async function sendOrSimulate(
  supabase: ReturnType<typeof createClient>,
  acao: AcaoAgente,
  config: AgentConfig,
  apiKey: string | null,
): Promise<{ success: boolean; resultado: string; simulada: boolean }> {
  const isSimulated = config.modo === 'ensaio'

  if (
    acao.tipo_acao === 'responder_candidato' ||
    acao.tipo_acao === 'enviar_whatsapp' ||
    acao.tipo_acao === 'enviar_mensagem'
  ) {
    if (isSimulated || !apiKey) {
      return {
        success: true,
        resultado: `[SIMULAÇÃO] Mensagem seria enviada para candidato ${acao.candidato_id}`,
        simulada: true,
      }
    }

    const result = await handleResponderCandidato(supabase, acao, apiKey, config)
    return { ...result, simulada: false }
  }

  if (acao.tipo_acao === 'escalar' || acao.tipo_acao === 'escalacao') {
    return {
      success: true,
      resultado: 'Candidato escalado para revisão humana',
      simulada: isSimulated,
    }
  }

  if (acao.tipo_acao === 'follow_up' || acao.tipo_acao === 'follow_up_base') {
    if (isSimulated || !apiKey) {
      return {
        success: true,
        resultado: `[SIMULAÇÃO] Follow-up processado para candidato ${acao.candidato_id}`,
        simulada: true,
      }
    }

    const result = await handleResponderCandidato(supabase, acao, apiKey, config)
    return { ...result, simulada: false }
  }

  if (acao.tipo_acao === 'cobranca_sem_resposta') {
    if (isSimulated || !apiKey) {
      return {
        success: true,
        resultado: `[SIMULAÇÃO] Cobrança por sem resposta processada para candidato ${acao.candidato_id}`,
        simulada: true,
      }
    }

    const result = await handleResponderCandidato(supabase, acao, apiKey, config)
    return { ...result, simulada: false }
  }

  if (acao.tipo_acao === 'lembrete_roteiro') {
    return {
      success: true,
      resultado: 'Lembrete de roteiro processado',
      simulada: isSimulated,
    }
  }

  if (acao.tipo_acao === 'notificar_operador') {
    return {
      success: true,
      resultado: 'Operador notificado',
      simulada: isSimulated,
    }
  }

  return {
    success: true,
    resultado: `Ação ${acao.tipo_acao} processada`,
    simulada: isSimulated,
  }
}

async function processAcao(
  supabase: ReturnType<typeof createClient>,
  acao: AcaoAgente,
): Promise<{ success: boolean; resultado: string; simulada: boolean; escalada: boolean }> {
  try {
    const { data: configData } = await supabase
      .from('configuracoes_agente')
      .select('*')
      .eq('tenant_id', acao.tenant_id)
      .eq('agent_type', acao.agent_type)
      .maybeSingle()

    const config: AgentConfig = configData ?? {
      id: '',
      tenant_id: acao.tenant_id,
      agent_type: acao.agent_type,
      modo: 'real',
      ativo: true,
      nome_agente: null,
      tom: 'profissional',
      tom_detalhe: null,
      mensagem_apresentacao: null,
      criterios_cv: null,
      criterios_entrevista: null,
      dias_sem_resposta: null,
      cadencia_follow_up_dias: null,
      prompt_disc: null,
      prompt_disc_versao: 1,
    }

    const apiKey = await getApiKey(acao.tenant_id)

    const { success, resultado, simulada } = await sendOrSimulate(supabase, acao, config, apiKey)

    const escalada = resultado.includes('escalada') || resultado.includes('escalado')

    return { success, resultado, simulada, escalada }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return { success: false, resultado: msg, simulada: false, escalada: false }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    const body = await req.json().catch(() => ({}))
    const {
      acao_id,
      batch = true,
      limit = 10,
    } = body as {
      acao_id?: string
      batch?: boolean
      limit?: number
    }

    let acoesToProcess: AcaoAgente[] = []

    if (acao_id) {
      const { data: acao, error } = await supabase
        .from('acoes_agente')
        .select('*')
        .eq('id', acao_id)
        .single()

      if (error || !acao) {
        return new Response(
          JSON.stringify({ error: 'Ação não encontrada', details: error?.message }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }
      acoesToProcess = [acao as AcaoAgente]
    } else if (batch) {
      const now = new Date().toISOString()
      const { data: acoes, error } = await supabase
        .from('acoes_agente')
        .select('*')
        .eq('status', 'pendente')
        .or(`agendada_para.is.null,agendada_para.lte.${now}`)
        .order('criado_em', { ascending: true })
        .limit(limit)

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar ações', details: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }
      acoesToProcess = (acoes ?? []) as AcaoAgente[]
    } else {
      return new Response(JSON.stringify({ error: 'Especifique acao_id ou ative batch=true' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (acoesToProcess.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'Nenhuma ação pendente',
          processadas: 0,
          concluidas: 0,
          simuladas: 0,
          escaladas: 0,
          falhas: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    const summary = {
      processadas: 0,
      concluidas: 0,
      simuladas: 0,
      escaladas: 0,
      falhas: 0,
    }

    const resultados: Array<{
      id: string
      success: boolean
      resultado: string
      simulada: boolean
    }> = []

    for (const acao of acoesToProcess) {
      const { data: claimed } = await supabase
        .from('acoes_agente')
        .update({ status: 'processando' })
        .eq('id', acao.id)
        .eq('status', 'pendente')
        .select()
        .single()

      if (!claimed) {
        continue
      }

      const { success, resultado, simulada, escalada } = await processAcao(supabase, acao)

      await supabase
        .from('acoes_agente')
        .update({
          status: success ? (simulada ? 'simulada' : 'concluida') : 'falhou',
          resultado,
          executada_em: new Date().toISOString(),
        })
        .eq('id', acao.id)

      if (acao.candidato_id) {
        await supabase.from('candidato_eventos').insert({
          candidato_id: acao.candidato_id,
          vaga_id: acao.vaga_id,
          tenant_id: acao.tenant_id,
          tipo: acao.tipo_acao,
          de: acao.status,
          para: success ? (simulada ? 'simulada' : 'concluida') : 'falhou',
          agente: acao.agent_type,
          ator: 'agentes-executor',
          payload: { resultado, acao_id: acao.id, simulada },
        })
      }

      summary.processadas++
      if (success && !simulada) summary.concluidas++
      if (simulada) summary.simuladas++
      if (escalada) summary.escaladas++
      if (!success) summary.falhas++

      resultados.push({ id: acao.id, success, resultado, simulada })
    }

    return new Response(
      JSON.stringify({
        message: 'Execução concluída',
        ...summary,
        resultados,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno do servidor'
    return new Response(
      JSON.stringify({
        error: 'Erro na execução',
        details: msg,
        processadas: 0,
        concluidas: 0,
        simuladas: 0,
        escaladas: 0,
        falhas: 0,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  }
})
