import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function parseICalDate(raw: string): string {
  let val = raw.trim()

  if (/^\d{8}$/.test(val)) {
    const y = val.substring(0, 4)
    const m = val.substring(4, 6)
    const d = val.substring(6, 8)
    return `${y}-${m}-${d}T00:00:00Z`
  }

  if (val.endsWith('Z')) {
    val = val.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')
    return val
  }

  val = val.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')
  return val
}

function unescapeICal(text: string): string {
  return text
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

interface ParsedEvent {
  titulo: string
  inicio: string
  fim: string
}

function parseICal(icalText: string): ParsedEvent[] {
  const unfolded = icalText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)

  const events: ParsedEvent[] = []
  let current: Partial<ParsedEvent> | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'BEGIN:VEVENT') {
      current = {}
    } else if (trimmed === 'END:VEVENT') {
      if (current && current.inicio && current.fim) {
        events.push({
          titulo: current.titulo ?? 'Sem título',
          inicio: current.inicio,
          fim: current.fim,
        })
      }
      current = null
    } else if (current) {
      if (trimmed.startsWith('SUMMARY:')) {
        current.titulo = unescapeICal(trimmed.substring(8))
      } else if (trimmed.startsWith('SUMMARY;')) {
        const colonIdx = trimmed.indexOf(':')
        if (colonIdx !== -1) {
          current.titulo = unescapeICal(trimmed.substring(colonIdx + 1))
        }
      } else if (trimmed.startsWith('DTSTART')) {
        const colonIdx = trimmed.indexOf(':')
        if (colonIdx !== -1) {
          current.inicio = parseICalDate(trimmed.substring(colonIdx + 1))
        }
      } else if (trimmed.startsWith('DTEND')) {
        const colonIdx = trimmed.indexOf(':')
        if (colonIdx !== -1) {
          current.fim = parseICalDate(trimmed.substring(colonIdx + 1))
        }
      }
    }
  }

  return events
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Missing server configuration' }, 500)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    const { agenda_externa_id, ical_url } = body

    if (!agenda_externa_id) {
      return jsonResponse({ error: 'agenda_externa_id is required' }, 400)
    }

    const { data: agenda, error: agendaError } = await supabase
      .from('agendas_externas')
      .select('ical_url, tenant_id')
      .eq('id', agenda_externa_id)
      .single()

    if (agendaError || !agenda) {
      return jsonResponse({ error: 'Agenda not found' }, 404)
    }

    const url = ical_url || agenda.ical_url
    if (!url) {
      return jsonResponse({ error: 'No iCal URL available for this agenda' }, 400)
    }

    const tenantId = agenda.tenant_id

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    let icalRes: Response
    try {
      icalRes = await fetch(url, {
        headers: {
          'User-Agent': 'Lynxs-Agenda-Sync/1.0',
          Accept: 'text/calendar, application/calendar, text/plain, */*',
        },
        signal: controller.signal,
      })
    } catch (fetchErr) {
      clearTimeout(timeoutId)
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown fetch error'
      return jsonResponse({ error: `Failed to fetch iCal feed: ${msg}` }, 502)
    }
    clearTimeout(timeoutId)

    if (!icalRes.ok) {
      return jsonResponse({ error: `Failed to fetch iCal feed: HTTP ${icalRes.status}` }, 502)
    }

    const icalText = await icalRes.text()
    const parsedEvents = parseICal(icalText)

    const { count: deletedCount, error: deleteError } = await supabase
      .from('eventos_agenda_externa')
      .delete({ count: 'exact' })
      .eq('agenda_externa_id', agenda_externa_id)

    if (deleteError) {
      return jsonResponse({ error: 'Failed to delete old events' }, 500)
    }

    if (parsedEvents.length > 0) {
      // Privacy: external calendar event titles are never stored in the database.
      // The connected agenda may be personal and appointment subjects (e.g. medical,
      // therapy, confidential meetings) do not belong to this product — only the
      // occupied time interval is needed for free-slot calculation.
      const rows = parsedEvents.map((e) => ({
        agenda_externa_id,
        tenant_id: tenantId,
        titulo: null,
        inicio: e.inicio,
        fim: e.fim,
      }))

      const { error: insertError } = await supabase.from('eventos_agenda_externa').insert(rows)

      if (insertError) {
        return jsonResponse({ error: 'Failed to insert events' }, 500)
      }
    }

    const now = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('agendas_externas')
      .update({ ultima_sincronizacao: now })
      .eq('id', agenda_externa_id)

    if (updateError) {
      return jsonResponse({ error: 'Failed to update last sync timestamp' }, 500)
    }

    return jsonResponse({
      success: true,
      events_synced: parsedEvents.length,
      events_deleted: deletedCount ?? 0,
      agenda_externa_id,
      ultima_sincronizacao: now,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return jsonResponse({ error: `Internal error: ${message}` }, 500)
  }
})
