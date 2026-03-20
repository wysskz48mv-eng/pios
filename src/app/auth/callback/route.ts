import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Ensure user profile + tenant exist
      const { data: profile } = await supabase
        .from('user_profiles').select('id').eq('id', data.user.id).single()
      if (!profile) {
        // Create tenant + profile for new user
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
            role: 'owner',
          })
        }
      }
      return NextResponse.redirect(`${origin}/platform/dashboard`)
    }
  }
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
