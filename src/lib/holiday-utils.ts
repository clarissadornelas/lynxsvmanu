export interface ParsedDate {
  date: string
  name: string
}

export interface ParseResult {
  valid: ParsedDate[]
  invalid: string[]
}

export function parseBulkDates(input: string): ParseResult {
  const lines = input
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const valid: ParsedDate[] = []
  const invalid: string[] = []
  const currentYear = new Date().getFullYear()

  for (const line of lines) {
    const parsed = parseLine(line, currentYear)
    if (parsed) {
      valid.push(parsed)
    } else {
      invalid.push(line)
    }
  }

  return { valid, invalid }
}

function parseLine(line: string, currentYear: number): ParsedDate | null {
  let m = line.match(/^(\d{4})-(\d{2})-(\d{2})\s*(.*)$/)
  if (m) {
    return { date: `${m[1]}-${m[2]}-${m[3]}`, name: m[4].trim() || 'Feriado' }
  }

  m = line.match(/^(\d{2})\/(\d{2})\/(\d{4})\s*(.*)$/)
  if (m) {
    return { date: `${m[3]}-${m[2]}-${m[1]}`, name: m[4].trim() || 'Feriado' }
  }

  m = line.match(/^(\d{2})\/(\d{2})\s*(.*)$/)
  if (m) {
    return { date: `${currentYear}-${m[2]}-${m[1]}`, name: m[3].trim() || 'Feriado' }
  }

  return null
}
