import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/refresh-google
// Exchanges a Google refresh_token for a new access_token
// Called automatically by email/sync when token is expired
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('google_refresh_token, google_token_expiry')
    .eq('id', user.id)
    .single()

  if (!profile?.google_refresh_token) {
    return NextResponse.json({ error: 'No refresh token stored. Please sign in with Google again.' }, { status: 400 })
  }

  // Check if token is actually expired (within 5 min buffer)
  if (profile.google_token_expiry) {
    const expiry = new Date(profile.google_token_expiry)
    if (expiry > new Date(Date.now() + 5 * 60 * 1000)) {
      return NextResponse.json({ refreshed: false, message: 'Token still valid' })
    }
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 })
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: profile.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: `Google refresh failed: ${err.error_description || err.error}` }, { status: 400 })
    }

    const tokens = await res.json()
    const newExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

    await supabase.from('user_profiles').update({
      google_access_token: tokens.access_token,
      google_token_expiry: newExpiry,
      // Google only returns a new refresh_token if rotation is enabled
      ...(tokens.refresh_token ? { google_refresh_token: tokens.refresh_token } : {}),
    }).eq('id', user.id)

    return NextResponse.json({ refreshed: true, expires_at: newExpiry })
  } catch (e) {
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 })
  }
}
