import type { TimeBlock } from './types'

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function generateSlots(blocks: TimeBlock[], durationMin: number): string[] {
  const slots: string[] = []
  for (const block of blocks) {
    let current = timeToMinutes(block.inicio)
    const end = timeToMinutes(block.fim)
    while (current + durationMin <= end) {
      slots.push(minutesToTime(current))
      current += durationMin
    }
  }
  return slots
}

export function isValidBlock(inicio: string, fim: string): boolean {
  return timeToMinutes(inicio) < timeToMinutes(fim)
}

export function blocksOverlap(a: TimeBlock, b: TimeBlock): boolean {
  return (
    timeToMinutes(a.inicio) < timeToMinutes(b.fim) && timeToMinutes(b.inicio) < timeToMinutes(a.fim)
  )
}
