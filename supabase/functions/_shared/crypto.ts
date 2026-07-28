const enc = new TextEncoder()
const dec = new TextDecoder()

function getSecret(): string {
  return Deno.env.get('ENCRYPTION_SECRET') ?? ''
}

export function hasEncryptionSecret(): boolean {
  const secret = getSecret()
  return secret.length > 0
}

export function getEncryptionSecretStatus(): {
  hasEncryptionSecret: boolean
  secretLength: number
  envVarName: string
} {
  const secret = getSecret()
  return {
    hasEncryptionSecret: secret.length > 0,
    secretLength: secret.length,
    envVarName: 'ENCRYPTION_SECRET',
  }
}

function getKey(): Promise<CryptoKey> {
  const secret = getSecret()
  const keyMaterial = enc.encode(secret)
  return crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(encrypted: string): Promise<string> {
  const key = await getKey()
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return dec.decode(plaintext)
}
