import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSignedOAuthState } from '@/lib/security/oauth-state'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MICROSOFT_SCOPE = 'openid profile email offline_access User.Read Mail.Read Mail.Send Calendars.Read'

export async function GET(req: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    const clientId = process.env.AZURE_CLIENT_ID
    const clientSecret = process.env.AZURE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/platform/settings?tab=email&error=Microsoft+OAuth+is+not+configured', appUrl))
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login?error=not_authenticated', appUrl))
    }

    const context = req.nextUrl.searchParams.get('context') ?? 'work'
    const label = req.nextUrl.searchParams.get('label') ?? ''
    const signedState = createSignedOAuthState({
      userId: user.id,
      context,
      label,
      expiresAt: Date.now() + 10 * 60 * 1000,
    })

    if (!signedState) {
      return NextResponse.redirect(new URL('/platform/settings?tab=email&error=Microsoft+OAuth+state+secret+is+not+configured', appUrl))
    }

    const redirectUri = `${appUrl}/api/auth/callback/microsoft`
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_mode', 'query')
    authUrl.searchParams.set('scope', MICROSOFT_SCOPE)
    authUrl.searchParams.set('state', signedState)
    authUrl.searchParams.set('prompt', 'select_account consent')

    return NextResponse.redirect(authUrl)
  } catch (err: any) {
    console.error('[PIOS auth/connect-microsoft]', err)
    return apiError(err)
  }
}
