import { format } from 'date-fns'
import type { Json } from '@/lib/supabase/types'
import { parseJanela, type DayKey } from '@/components/job-availability/types'
import { generateSlots } from '@/components/job-availability/utils'
import type { BusySlot } from './getBusySlots'

const JS_DAY_TO_KEY: Record<number, DayKey> = {
  0: 'dom',
  1: 'seg',
  2: 'ter',
  3: 'qua',
  4: 'qui',
  5: 'sex',
  6: 'sab',
}

export interface GeneratedSlot {
  time: string
  date: Date
  endDate: Date
  busy: boolean
  dayLimit: boolean
  expired: boolean
}

export function generateWeekSlots(
  days: Date[],
  janela: Json | null,
  dataLimite: string | null,
  maxAgendamentos: number,
  busySlots: BusySlot[],
  dailyCounts: Record<string, number>,
): GeneratedSlot[][] {
  const config = parseJanela(janela)
  const deadline = dataLimite ? new Date(`${dataLimite}T23:59:59`) : null

  return days.map((day) => {
    const dayKey = JS_DAY_TO_KEY[day.getDay()]
    const blocks = config.semana[dayKey] || []
    const timeSlots = generateSlots(blocks, config.duracao_min)
    const dayStr = format(day, 'yyyy-MM-dd')
    const dayCount = dailyCounts[dayStr] || 0
    const atLimit = dayCount >= maxAgendamentos

    return timeSlots.map((time) => {
      const [h, m] = time.split(':').map(Number)
      const slotDate = new Date(day)
      slotDate.setHours(h, m, 0, 0)
      const slotEnd = new Date(slotDate.getTime() + config.duracao_min * 60000)

      const expired = deadline ? slotDate > deadline : false
      const busy = busySlots.some((bs) => slotDate < bs.fim && slotEnd > bs.inicio)

      return {
        time,
        date: slotDate,
        endDate: slotEnd,
        busy,
        dayLimit: atLimit,
        expired,
      }
    })
  })
}

export function countFreeSlots(weekSlots: GeneratedSlot[][]): number {
  return weekSlots.flat().filter((s) => !s.busy && !s.dayLimit && !s.expired).length
}
