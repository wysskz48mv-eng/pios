import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Authenticated users go straight to their dashboard
  if (user) redirect('/platform/dashboard')
  // Unauthenticated visitors see the pricing/landing page
  redirect('/pricing')
}
