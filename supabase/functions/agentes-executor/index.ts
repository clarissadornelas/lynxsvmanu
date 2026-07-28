import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decrypt } from '../_shared/crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const CLASSIFY_PROMPT = `Classifique a mensagem de um candidato de recrutamento em UMA categoria: 'confirmar' (confirma presença/interesse), 'reagendar' (pede outro horário), 'sair' (pede para não ser mais contatado, desiste, opt-out), 'pergunta' (faz uma pergunta sobre a vaga/processo), 'outro' (qualquer outra coisa, ambíguo, vazio ou fora de contexto). Responda só JSON: {"categoria": string, "confianca": número 0 a 1}.`

async function getApiKey(tenantId: string): Promise<string | null> {
  const { data: row, error } = await supabase
    .from('ai_provider_keys')
    .select('api_key_encrypted')
    .eq('tenant_id', tenantId)
    .eq('provider', 'openai')
    .maybeSingle()
  if (error) {
    console.error(`[getApiKey] Error fetching API key for tenant ${tenantId}:`, error.message)
    return null
  }
  if (!row) {
    console.error(`[getApiKey] No API key found for tenant ${tenantId}`)
    return null
  }
  try {
    return await decrypt(row.api_key_encrypted)
  } catch (e) {
    console.error(`[getApiKey] Decrypt failed for tenant ${tenantId}:`, e)
    return null
  }
}

async function classifyMessage(apiKey: string, msg: string) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CLASSIFY_PROMPT },
          { role: 'user', content: msg },
        ],
      }),
    })
    if (!res.ok) throw new Error()
    const parsed = JSON.parse((await res.json()).choices[0].message.content)
    const valid = ['confirmar', 'reagendar', 'sair', 'pergunta', 'outro']
    return {
      categoria: valid.includes(parsed.categoria) ? parsed.categoria : 'outro',
      confianca: typeof parsed.confianca === 'number' ? parsed.confianca : 0,
    }
  } catch {
    return { categoria: 'outro', confianca: 0 }
  }
}

async function composeMessage(apiKey: string, sys: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: 'Escreva a mensagem agora.' },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`)
  return (await res.json()).choices[0].message.content.trim()
}

async function dispatchWhatsApp(
  candidateId: string,
  phone: string,
  message: string,
  contexto: string,
): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ candidateId, phone, message, contexto }),
  })
  return res.ok
}

async function updateBaseAtivaEngagement(tenantId: string, candidatoId: string): Promise<void> {
  const { data: baseRow, error: baseErr } = await supabase
    .from('base_ativa')
    .select('id, pings_enviados')
    .eq('tenant_id', tenantId)
    .eq('candidato_id', candidatoId)
    .limit(1)
    .maybeSingle()

  if (baseErr || !baseRow) {
    console.error(
      `[updateBaseAtivaEngagement] Failed to fetch base_ativa for candidato ${candidatoId}:`,
      baseErr?.message || 'not found',
    )
    return
  }

  const { error: updateErr } = await supabase
    .from('base_ativa')
    .update({
      ultimo_ping_em: new Date().toISOString(),
      pings_enviados: (baseRow.pings_enviados ?? 0) + 1,
    })
    .eq('id', baseRow.id)

  if (updateErr) {
    console.error(
      `[updateBaseAtivaEngagement] Failed to update base_ativa for candidato ${candidatoId}:`,
      updateErr.message,
    )
  }
}

async function sendOrSimulate(
  action: any,
  config: any,
  apiKey: string,
  phone: string | null,
  sysPrompt: string,
  summary: any,
) {
  const message = await composeMessage(apiKey, sysPrompt)
  const modo = config?.modo || 'real'
  if (modo === 'ensaio') {
    await supabase
      .from('acoes_agente')
      .update({
        status: 'simulada',
        texto_composto: message,
        executada_em: new Date().toISOString(),
      })
      .eq('id', action.id)
    summary.simuladas++
    return
  }
  if (!phone) {
    await supabase
      .from('acoes_agente')
      .update({ status: 'falhou', texto_composto: message, resultado: 'Candidato sem telefone' })
      .eq('id', action.id)
    summary.falhas++
    return
  }
  const contexto = action.agent_type === 'base_ativa' ? 'follow_up' : 'assessor'
  const ok = await dispatchWhatsApp(action.candidato_id, phone, message, contexto)
  if (ok) {
    await supabase
      .from('acoes_agente')
      .update({
        status: 'concluida',
        texto_composto: message,
        executada_em: new Date().toISOString(),
      })
      .eq('id', action.id)
    summary.concluidas++

    if (action.tipo_acao === 'follow_up_base') {
      await updateBaseAtivaEngagement(action.tenant_id, action.candidato_id)
    }
  } else {
    await supabase
      .from('acoes_agente')
      .update({
        status: 'falhou',
        texto_composto: message,
        resultado: 'Falha no dispatch do WhatsApp',
      })
      .eq('id', action.id)
    summary.falhas++
  }
}

async function handleResponderCandidato(action: any, config: any, summary: any) {
  const originalMsg = action.resultado || ''
  const { data: cand } = await supabase
    .from('candidatos')
    .select('nome, telefone')
    .eq('id', action.candidato_id)
    .maybeSingle()
  const apiKey = await getApiKey(action.tenant_id)
  if (!apiKey) {
    await supabase
      .from('acoes_agente')
      .update({
        status: 'falhou',
        resultado:
          'Esta empresa ainda não tem chave de IA configurada. Peça ao administrador para configurar em Configurações.',
      })
      .eq('id', action.id)
    summary.falhas++
    return
  }
  const { categoria, confianca } = await classifyMessage(apiKey, originalMsg)
  const { data: tenant } = await supabase
    .from('tenants')
    .select('agente_nome')
    .eq('id', action.tenant_id)
    .maybeSingle()
  const criterios = (config?.criterios ?? {}) as Record<string, unknown>
  const tom = (criterios.tom as string) || 'profissional'
  const tomPart = criterios.tom_detalhe ? `. ${criterios.tom_detalhe as string}` : ''
  const agenteNome = tenant?.agente_nome || 'Assistente'
  const phone = cand?.telefone ?? null

  if (categoria === 'sair') {
    await supabase
      .from('candidatos')
      .update({ opt_out: true, opt_out_em: new Date().toISOString() })
      .eq('id', action.candidato_id)
    await supabase
      .from('base_ativa')
      .update({ opt_out: true, opt_out_em: new Date().toISOString() })
      .eq('candidato_id', action.candidato_id)
    const sys = `Você compõe uma única mensagem curta de WhatsApp em português brasileiro, da parte de um assistente de recrutamento chamado ${agenteNome}, em tom ${tom}${tomPart}. O candidato pediu para não ser mais contatado. Confirme a remoção de forma breve e respeitosa. Responda SOMENTE o texto da mensagem, sem aspas, máximo 300 caracteres.`
    await sendOrSimulate(action, config, apiKey, phone, sys, summary)
    await supabase.from('acoes_agente').insert({
      tenant_id: action.tenant_id,
      agent_type: action.agent_type,
      tipo_acao: 'notificar_operador',
      candidato_id: action.candidato_id,
      vaga_id: action.vaga_id,
      agendada_para: new Date().toISOString(),
      status: 'pendente',
      texto_composto: `Opt-out: ${cand?.nome || 'candidato'} pediu para não ser mais contatado.`,
      resultado: originalMsg,
    })
    return
  }

  if (categoria === 'confirmar' && confianca >= 0.8) {
    await supabase
      .from('acoes_agente')
      .update({ status: 'cancelada' })
      .eq('candidato_id', action.candidato_id)
      .in('tipo_acao', ['cobranca_sem_resposta', 'follow_up_base'])
      .eq('status', 'pendente')
    const sys = `Você compõe uma única mensagem curta de WhatsApp em português brasileiro, da parte de um assistente de recrutamento chamado ${agenteNome}, em tom ${tom}${tomPart}. O candidato confirmou presença/interesse. Agradeça brevemente. Responda SOMENTE o texto da mensagem, sem aspas, máximo 300 caracteres.`
    await sendOrSimulate(action, config, apiKey, phone, sys, summary)
    return
  }

  if (categoria === 'reagendar' && confianca >= 0.8) {
    await supabase
      .from('acoes_agente')
      .update({
        status: 'aguardando_humano',
        motivo_escalacao: `Candidato pediu reagendamento: '${originalMsg}'`,
      })
      .eq('id', action.id)
    summary.escaladas++
    return
  }

  await supabase
    .from('acoes_agente')
    .update({ status: 'aguardando_humano', motivo_escalacao: originalMsg })
    .eq('id', action.id)
  summary.escaladas++
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const summary = { processadas: 0, concluidas: 0, simuladas: 0, escaladas: 0, falhas: 0 }

  try {
    const { data: actions, error } = await supabase
      .from('acoes_agente')
      .select('*')
      .eq('status', 'pendente')
      .lte('agendada_para', new Date().toISOString())
      .order('agendada_para', { ascending: true })
      .limit(10)
    if (error) throw error

    for (const action of actions ?? []) {
      summary.processadas++
      try {
        await supabase.from('acoes_agente').update({ status: 'executando' }).eq('id', action.id)
        const { data: config } = await supabase
          .from('configuracoes_agente')
          .select('*')
          .eq('tenant_id', action.tenant_id)
          .eq('agent_type', action.agent_type)
          .maybeSingle()
        if (config && config.ativo === false) {
          await supabase
            .from('acoes_agente')
            .update({ status: 'cancelada', resultado: 'agente desativado' })
            .eq('id', action.id)
          continue
        }

        if (action.tipo_acao === 'lembrete_roteiro' || action.tipo_acao === 'notificar_operador') {
          let motivo =
            action.motivo_escalacao || action.texto_composto || 'Intervenção humana necessária'
          if (action.candidato_id) {
            const { data: cand } = await supabase
              .from('candidatos')
              .select('nome')
              .eq('id', action.candidato_id)
              .maybeSingle()
            if (cand?.nome) {
              motivo =
                action.tipo_acao === 'lembrete_roteiro'
                  ? `Entrevista de ${cand.nome} em ${new Date(action.agendada_para).toLocaleString('pt-BR')} sem roteiro`
                  : `Notificar operador sobre ${cand.nome}`
            }
          }
          await supabase
            .from('acoes_agente')
            .update({ status: 'aguardando_humano', motivo_escalacao: motivo })
            .eq('id', action.id)
          summary.escaladas++
          continue
        }

        if (action.tipo_acao === 'responder_candidato') {
          await handleResponderCandidato(action, config, summary)
          continue
        }

        if (action.tipo_acao === 'follow_up_base' || action.tipo_acao === 'cobranca_sem_resposta') {
          const { data: cand } = await supabase
            .from('candidatos')
            .select('nome, telefone')
            .eq('id', action.candidato_id)
            .maybeSingle()
          let vagaTitulo = 'N/A'
          if (action.vaga_id) {
            const { data: vaga } = await supabase
              .from('vagas')
              .select('titulo')
              .eq('id', action.vaga_id)
              .maybeSingle()
            if (vaga?.titulo) vagaTitulo = vaga.titulo
          }
          const { data: tenant } = await supabase
            .from('tenants')
            .select('agente_nome')
            .eq('id', action.tenant_id)
            .maybeSingle()
          const apiKey = await getApiKey(action.tenant_id)
          if (!apiKey) {
            await supabase
              .from('acoes_agente')
              .update({
                status: 'falhou',
                resultado:
                  'Esta empresa ainda não tem chave de IA configurada. Peça ao administrador para configurar em Configurações.',
              })
              .eq('id', action.id)
            summary.falhas++
            continue
          }
          const criterios = (config?.criterios ?? {}) as Record<string, unknown>
          const tom = (criterios.tom as string) || 'profissional'
          const tomDetalhe = criterios.tom_detalhe as string | undefined
          const nomeAgente = tenant?.agente_nome || 'Assistente'
          const contexto =
            action.tipo_acao === 'follow_up_base'
              ? 'Follow-up com contato da base ativa'
              : 'Cobrança por falta de resposta do candidato'
          const tomPart = tomDetalhe ? `. ${tomDetalhe}` : ''
          const sys = `Você compõe uma única mensagem curta de WhatsApp em português brasileiro, da parte de um assistente de recrutamento chamado ${nomeAgente}, em tom ${tom}${tomPart}. Contexto: ${contexto}. Candidato: ${cand?.nome || 'candidato'}. Vaga: ${vagaTitulo}. Responda SOMENTE o texto da mensagem, sem aspas, máximo 400 caracteres.`
          await sendOrSimulate(action, config, apiKey, cand?.telefone ?? null, sys, summary)
        }
      } catch (err: any) {
        summary.falhas++
        try {
          await supabase
            .from('acoes_agente')
            .update({ status: 'falhou', resultado: String(err?.message || err) })
            .eq('id', action.id)
        } catch {
          /* noop */
        }
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, ...summary }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
