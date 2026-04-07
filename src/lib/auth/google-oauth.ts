export const GOOGLE_OAUTH_INTENT_PARAM = 'google_intent'

export type GoogleOAuthIntent = 'auth' | 'workspace'

const GOOGLE_AUTH_SCOPES = [
  'openid',
  'email',
  'profile',
].join(' ')

const GOOGLE_WORKSPACE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ')

function normaliseNextPath(next: string | null): string | null {
  if (!next?.startsWith('/')) return null
  if (next.startsWith('//')) return null
  return next
}

export function buildGoogleCallbackUrl(origin: string, next: string | null, intent: GoogleOAuthIntent): string {
  const callbackUrl = new URL('/auth/callback', origin)
  const safeNext = normaliseNextPath(next)

  if (safeNext) callbackUrl.searchParams.set('next', safeNext)
  callbackUrl.searchParams.set(GOOGLE_OAUTH_INTENT_PARAM, intent)

  return callbackUrl.toString()
}

export function buildGoogleOAuthOptions(origin: string, next: string | null, intent: GoogleOAuthIntent) {
  const queryParams = intent === 'workspace'
    ? { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' }
    : undefined

  return {
    redirectTo: buildGoogleCallbackUrl(origin, next, intent),
    scopes: intent === 'workspace' ? GOOGLE_WORKSPACE_SCOPES : GOOGLE_AUTH_SCOPES,
    ...(queryParams ? { queryParams } : {}),
  }
}

export function parseGoogleOAuthIntent(value: string | null): GoogleOAuthIntent {
  return value === 'workspace' ? 'workspace' : 'auth'
}