import crypto from 'node:crypto'

const PREFIX = 'enc:v1'

function resolveEncryptionKey(): Buffer | null {
  const raw = process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim()
  if (!raw) return null

  if (/^[a-fA-F0-9]{64}$/.test(raw)) return Buffer.from(raw, 'hex')

  try {
    const decoded = Buffer.from(raw, 'base64')
    if (decoded.length === 32) return decoded
  } catch {
    // fall through
  }

  return crypto.createHash('sha256').update(raw, 'utf8').digest()
}

export function encryptOAuthToken(value: string | null | undefined): string | null {
  if (!value) return null

  const key = resolveEncryptionKey()
  if (!key) return value

  if (value.startsWith(`${PREFIX}:`)) return value

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptOAuthToken(value: string | null | undefined): string | null {
  if (!value) return null

  if (!value.startsWith(`${PREFIX}:`)) return value

  const key = resolveEncryptionKey()
  if (!key) {
    throw new Error('Encountered encrypted OAuth token but OAUTH_TOKEN_ENCRYPTION_KEY is not configured')
  }

  const [, version, ivB64, tagB64, encryptedB64] = value.split(':')
  if (version !== 'v1' || !ivB64 || !tagB64 || !encryptedB64) {
    throw new Error('Malformed encrypted OAuth token payload')
  }

  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function decryptOAuthTokenSafe(value: string | null | undefined): string | null {
  try {
    return decryptOAuthToken(value)
  } catch {
    return null
  }
}
