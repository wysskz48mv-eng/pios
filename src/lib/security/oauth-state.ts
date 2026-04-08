import { createHmac, timingSafeEqual } from 'node:crypto'

type OAuthStatePayload = {
  userId: string
  context?: string
  label?: string
  expiresAt: number
}

function getOAuthStateSecret(): string | null {
  const secret = process.env.OAUTH_STATE_SECRET ?? process.env.NEXTAUTH_SECRET
  return secret?.trim() || null
}

function signStatePayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

export function createSignedOAuthState(payload: OAuthStatePayload): string | null {
  const secret = getOAuthStateSecret()
  if (!secret) return null

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = signStatePayload(encodedPayload, secret)

  return `${encodedPayload}.${signature}`
}

export function verifySignedOAuthState(state: string | null | undefined): OAuthStatePayload | null {
  const secret = getOAuthStateSecret()
  if (!secret || !state) return null

  const [encodedPayload, providedSignature] = state.split('.')
  if (!encodedPayload || !providedSignature) return null

  const expectedSignature = signStatePayload(encodedPayload, secret)
  const providedBuffer = Buffer.from(providedSignature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (providedBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString()) as OAuthStatePayload
    if (!payload?.userId || typeof payload.expiresAt !== 'number') return null
    if (payload.expiresAt <= Date.now()) return null
    return payload
  } catch {
    return null
  }
}