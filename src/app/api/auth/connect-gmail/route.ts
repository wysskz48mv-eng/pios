/**
 * GET /api/auth/connect-gmail
 * Initiates Google OAuth with Gmail + Calendar scopes
 * Redirects to Supabase OAuth, then back to /auth/callback
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

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
        prompt: 'consent',
      },
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(new URL('/platform/settings?error=oauth_failed', req.url))
  }

  return NextResponse.redirect(data.url)
}
