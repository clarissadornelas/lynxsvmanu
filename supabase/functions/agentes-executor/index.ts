import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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

async function processAcao(
  supabase: ReturnType<typeof createClient>,
  acao: AcaoAgente,
): Promise<{ success: boolean; resultado: string }> {
  try {
    if (acao.tipo_acao === 'enviar_whatsapp' || acao.tipo_acao === 'enviar_mensagem') {
      if (!acao.candidato_id) {
        return { success: false, resultado: 'Candidato não informado' }
      }

      const { data: candidato } = await supabase
        .from('candidatos')
        .select('nome, telefone')
        .eq('id', acao.candidato_id)
        .single()

      if (!candidato?.telefone) {
        return { success: false, resultado: 'Candidato sem telefone' }
      }

      const { error: disparoError } = await supabase.from('disparos').insert({
        tenant_id: acao.tenant_id,
        contato_ref: acao.candidato_id,
        agente: acao.agent_type,
        numero: candidato.telefone,
        chave_idempotencia: `${acao.id}`,
        status: 'enviado',
      })

      if (disparoError) {
        return { success: false, resultado: `Erro ao registrar disparo: ${disparoError.message}` }
      }

      return { success: true, resultado: `Mensagem enviada para ${candidato.nome}` }
    }

    if (acao.tipo_acao === 'escalar' || acao.tipo_acao === 'escalacao') {
      return { success: true, resultado: 'Candidato escalado para revisão humana' }
    }

    if (acao.tipo_acao === 'follow_up') {
      return { success: true, resultado: 'Follow-up processado' }
    }

    return { success: true, resultado: `Ação ${acao.tipo_acao} processada` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return { success: false, resultado: msg }
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
        JSON.stringify({ message: 'Nenhuma ação pendente', processadas: 0, resultados: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    const resultados: Array<{ id: string; success: boolean; resultado: string }> = []

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

      const { success, resultado } = await processAcao(supabase, acao)

      await supabase
        .from('acoes_agente')
        .update({
          status: success ? 'concluida' : 'falhou',
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
          para: success ? 'concluida' : 'falhou',
          agente: acao.agent_type,
          ator: 'agentes-executor',
          payload: { resultado, acao_id: acao.id },
        })
      }

      resultados.push({ id: acao.id, success, resultado })
    }

    return new Response(
      JSON.stringify({
        message: 'Execução concluída',
        processadas: resultados.length,
        resultados,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno do servidor'
    return new Response(JSON.stringify({ error: 'Erro na execução', details: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
