import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Check onboarding status — never skip the wizard
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: profile } = await admin
      .from('user_profiles')
      .select('onboarded')
      .eq('id', user.id)
      .single()

    if (profile?.onboarded === false) {
      redirect('/onboarding')
    }
    redirect('/platform/dashboard')
  }

  // Unauthenticated visitors see the pricing/landing page
  redirect('/pricing')
}
