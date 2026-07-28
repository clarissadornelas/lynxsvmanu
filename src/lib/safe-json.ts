export function safeJsonParse<T>(text: string | null | undefined, fallback: T): T {
  if (!text || text.trim() === '') return fallback
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

export async function safeResponseJson<T>(response: Response, fallback: T): Promise<T> {
  try {
    const text = await response.text()
    if (!text || text.trim() === '') return fallback
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

export function isSafeToParseJson(text: string | null | undefined): boolean {
  if (!text || text.trim() === '') return false
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}
