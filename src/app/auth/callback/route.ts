import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Capture Google OAuth tokens from the session
      const providerToken = data.session?.provider_token ?? null
      const providerRefreshToken = data.session?.provider_refresh_token ?? null
      const tokenExpiry = providerToken
        ? new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour from now
        : null

      // Check if profile already exists
      const { data: profile } = await supabase
        .from('user_profiles').select('id').eq('id', data.user.id).single()

      if (!profile) {
        // New user — create tenant + profile
        const { data: tenant } = await supabase.from('tenants').insert({
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'My PIOS',
          slug: data.user.id.substring(0, 8),
          plan: 'individual',
        }).select().single()

        if (tenant) {
          await supabase.from('user_profiles').insert({
            id: data.user.id,
            tenant_id: tenant.id,
            full_name: data.user.user_metadata?.full_name,
            avatar_url: data.user.user_metadata?.avatar_url,
            google_email: data.user.email,
            google_access_token: providerToken,
            google_refresh_token: providerRefreshToken,
            google_token_expiry: tokenExpiry,
            role: 'owner',
          })
        }
      } else if (providerToken) {
        // Returning user via Google — refresh stored tokens
        await supabase.from('user_profiles').update({
          google_access_token: providerToken,
          google_refresh_token: providerRefreshToken,
          google_token_expiry: tokenExpiry,
          avatar_url: data.user.user_metadata?.avatar_url,
        }).eq('id', data.user.id)
      }

      return NextResponse.redirect(`${origin}/platform/dashboard`)
    }
  }
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
