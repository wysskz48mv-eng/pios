/**
 * GET /api/auth/connect-gmail
 * Connects Gmail + Calendar for an already-authenticated user.
 *
 * Uses signInWithOAuth with prompt=consent + access_type=offline so Google
 * returns a fresh refresh_token. The callback stores both tokens into
 * user_profiles and redirects to /platform/email.
 *
 * Note: signInWithOAuth on an existing session will re-use the same Supabase
 * user — it does NOT create a new account. The callback handles the
 * token-storage leg, not a new user creation leg.
 *
 * VeritasIQ Technologies Ltd · PIOS
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
  const supabase = createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

  // Verify user is already authenticated before initiating OAuth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login?error=not_authenticated', req.url))
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/platform/email`,
      scopes: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/drive.readonly',
      ].join(' '),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',   // Force consent screen so Google returns refresh_token
      },
    },
  })

  if (error || !data.url) {
    console.error('[connect-gmail] OAuth init error:', error?.message)
    return NextResponse.redirect(new URL('/platform/settings?error=oauth_failed', req.url))
  }

  return NextResponse.redirect(data.url)
} catch (err: any) {
    console.error('[PIOS auth/connect-gmail]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
