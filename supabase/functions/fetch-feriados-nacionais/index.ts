import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const year = body.year || new Date().getFullYear()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`BrasilAPI retornou status ${response.status}`)
    }

    const holidays = await response.json()

    return new Response(JSON.stringify({ holidays, year }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError'
    return new Response(
      JSON.stringify({
        error: isTimeout ? 'Tempo limite excedido ao contatar a BrasilAPI' : error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
