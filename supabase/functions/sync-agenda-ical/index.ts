import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface ParsedEvent {
  start: string
  end: string
  summary: string | null
}

function unescapeICal(text: string): string {
  return text.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

function parseICalDate(value: string): string {
  const dateOnlyMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(value)
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}T00:00:00Z`
  }

  const utcMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value)
  if (utcMatch) {
    return `${utcMatch[1]}-${utcMatch[2]}-${utcMatch[3]}T${utcMatch[4]}:${utcMatch[5]}:${utcMatch[6]}Z`
  }

  const floatingMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(value)
  if (floatingMatch) {
    return `${floatingMatch[1]}-${floatingMatch[2]}-${floatingMatch[3]}T${floatingMatch[4]}:${floatingMatch[5]}:${floatingMatch[6]}Z`
  }

  return value
}

function parseICal(icalText: string): ParsedEvent[] {
  const unfolded = icalText.replace(/\r?\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)

  const events: ParsedEvent[] = []
  let inEvent = false
  let currentStart: string | undefined
  let currentEnd: string | undefined
  let currentSummary: string | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      currentStart = undefined
      currentEnd = undefined
      currentSummary = null
      continue
    }
    if (line === 'END:VEVENT') {
      if (inEvent && currentStart && currentEnd) {
        events.push({
          start: currentStart,
          end: currentEnd,
          summary: currentSummary,
        })
      }
      inEvent = false
      continue
    }
    if (!inEvent) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const propertyPart = line.substring(0, colonIdx)
    const value = line.substring(colonIdx + 1)

    const semiIdx = propertyPart.indexOf(';')
    const propertyName = semiIdx === -1 ? propertyPart : propertyPart.substring(0, semiIdx)

    if (propertyName === 'DTSTART') {
      currentStart = parseICalDate(value)
    } else if (propertyName === 'DTEND') {
      currentEnd = parseICalDate(value)
    } else if (propertyName === 'SUMMARY') {
      currentSummary = unescapeICal(value)
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
    if (!authHeader) throw new Error('Missing Authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const body = await req.json()
    const agendaExternaId: string | undefined = body.agenda_externa_id

    if (!agendaExternaId) {
      return new Response(JSON.stringify({ error: 'agenda_externa_id is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const { data: agenda, error: agendaError } = await supabase
      .from('agendas_externas')
      .select('*')
      .eq('id', agendaExternaId)
      .single()

    if (agendaError || !agenda) {
      return new Response(JSON.stringify({ error: 'Agenda externa not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    if (!agenda.ical_url) {
      return new Response(JSON.stringify({ error: 'No iCal URL configured for this agenda' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    let icalResponse: Response
    try {
      icalResponse = await fetch(agenda.ical_url, {
        signal: controller.signal,
        headers: { Accept: 'text/calendar, text/plain, */*' },
      })
    } catch (fetchErr: any) {
      clearTimeout(timeout)
      const isTimeout = fetchErr.name === 'AbortError'
      return new Response(
        JSON.stringify({
          error: isTimeout
            ? 'Network timeout while fetching iCal URL (15s)'
            : `Failed to fetch iCal URL: ${fetchErr.message}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 },
      )
    }
    clearTimeout(timeout)

    if (!icalResponse.ok) {
      return new Response(
        JSON.stringify({
          error: `iCal URL returned status ${icalResponse.status}: ${icalResponse.statusText}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 },
      )
    }

    const icalText = await icalResponse.text()
    const parsedEvents = parseICal(icalText)

    console.log(
      `[sync-agenda-ical] Parsed ${parsedEvents.length} events from iCal for agenda ${agendaExternaId}`,
    )

    const { error: deleteError, count: deletedCount } = await supabase
      .from('eventos_agenda_externa')
      .delete({ count: 'exact' })
      .eq('agenda_externa_id', agendaExternaId)

    if (deleteError) {
      console.error('[sync-agenda-ical] Error deleting old events:', deleteError.message)
      return new Response(
        JSON.stringify({ error: `Failed to clear old events: ${deleteError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }

    console.log(`[sync-agenda-ical] Deleted ${deletedCount ?? 0} old cached events`)

    if (parsedEvents.length > 0) {
      const rowsToInsert = parsedEvents.map((evt) => ({
        agenda_externa_id: agendaExternaId,
        tenant_id: agenda.tenant_id,
        inicio: evt.start,
        fim: evt.end,
        titulo: evt.summary,
      }))

      const { error: insertError } = await supabase
        .from('eventos_agenda_externa')
        .insert(rowsToInsert)

      if (insertError) {
        console.error('[sync-agenda-ical] Error inserting events:', insertError.message)
        return new Response(
          JSON.stringify({ error: `Failed to insert events: ${insertError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
        )
      }

      console.log(`[sync-agenda-ical] Inserted ${parsedEvents.length} new events`)
    }

    const { error: updateError } = await supabase
      .from('agendas_externas')
      .update({ ultima_sincronizacao: new Date().toISOString() })
      .eq('id', agendaExternaId)

    if (updateError) {
      console.error('[sync-agenda-ical] Error updating ultima_sincronizacao:', updateError.message)
    }

    return new Response(
      JSON.stringify({
        success: true,
        events_synced: parsedEvents.length,
        events_deleted: deletedCount ?? 0,
        agenda_externa_id: agendaExternaId,
        ultima_sincronizacao: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error: any) {
    console.error('[sync-agenda-ical] Unhandled error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
