import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { decrypt } from '../_shared/crypto.ts'
import OpenAI from 'npm:openai@4.52.0'

const TOM_SYSTEM_PROMPT = `You are a recruitment message tone validator. Your job is to determine whether a given message adheres to the specified tone guidelines.

Rules for rejection:
- The message is overly informal, slang-heavy, or unprofessional.
- The message contains aggressive, rude, or dismissive language.
- The message does not match the requested tone (e.g., too casual when "professional" is required).
- The message is incoherent or empty.

Respond in JSON with exactly two fields:
{
  "permitido": boolean,   // true if the message passes tone validation, false otherwise
  "motivo": string        // a short explanation of the decision
}`

const CRITERIOS_SYSTEM_PROMPT = `Você é um validador de mensagens de recrutamento. Sua função é verificar se a mensagem atende aos critérios de avaliação profissional estabelecidos.

Critérios de reprovação:
- A mensagem é excessivamente informal, gírias ou imprópria para o contexto profissional.
- A mensagem contém linguagem agressiva, rude ou desrespeitosa.
- A mensagem não segue os critérios de avaliação definidos (ex.: clareza, objetividade, cordialidade).
- A mensagem é incoerente ou vazia.

Responda em JSON com exatamente dois campos:
{
  "permitido": boolean,   // true se a mensagem passar na validação de critérios, false caso contrário
  "motivo": string        // uma breve explicação da decisão
}`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ permitido: false, motivo: 'Não autorizado' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ permitido: false, motivo: 'Configuração do servidor ausente.' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ permitido: false, motivo: 'Não autorizado' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return new Response(
        JSON.stringify({ permitido: false, motivo: 'Corpo da requisição inválido.' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    const { mensagem, tom, tom_detalhe, nome_agente, contexto, criterios, tenant_id } = body

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ permitido: false, motivo: 'Empresa precisa configurar uma chave de IA.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    if (!mensagem) {
      return new Response(
        JSON.stringify({ permitido: false, motivo: 'Campo obrigatório ausente: mensagem.' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    const { data: keyRow, error: keyErr } = await supabase
      .from('ai_provider_keys')
      .select('api_key_encrypted')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'openai')
      .maybeSingle()

    if (keyErr || !keyRow || !keyRow.api_key_encrypted) {
      return new Response(
        JSON.stringify({
          permitido: false,
          motivo: 'Nenhuma chave de provedor de IA configurada para esta empresa.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    let decryptedKey: string
    try {
      decryptedKey = await decrypt(keyRow.api_key_encrypted)
    } catch {
      return new Response(
        JSON.stringify({
          permitido: false,
          motivo: 'Falha ao descriptografar a chave de IA. Contate o suporte.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    const validationContext = contexto === 'criterios' ? 'criterios' : 'tom'
    const systemPrompt =
      validationContext === 'criterios' ? CRITERIOS_SYSTEM_PROMPT : TOM_SYSTEM_PROMPT

    let userPrompt: string
    if (validationContext === 'tom') {
      userPrompt = `Agente: ${nome_agente ?? 'N/A'}\nTom esperado: ${tom ?? 'profissional'}${tom_detalhe ? ` (${tom_detalhe})` : ''}\nMensagem:\n${mensagem}`
    } else {
      userPrompt = `Critérios de avaliação:\n${criterios ?? 'N/A'}\nMensagem:\n${mensagem}`
    }

    const openai = new OpenAI({ apiKey: decryptedKey })

    let aiContent: string
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      })
      aiContent = completion.choices?.[0]?.message?.content ?? ''
    } catch {
      return new Response(
        JSON.stringify({ permitido: false, motivo: 'Falha na comunicação com o provedor de IA.' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    let result: { permitido: boolean; motivo: string }
    try {
      result = JSON.parse(aiContent)
    } catch {
      result = { permitido: false, motivo: 'Falha na validação, tente novamente.' }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch {
    return new Response(JSON.stringify({ permitido: false, motivo: 'Erro interno do servidor.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
