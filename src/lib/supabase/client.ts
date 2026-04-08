import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublicKey, getSupabaseUrl } from '@/lib/supabase/env'

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>

export function createClient(): BrowserSupabaseClient | null {
  const supabaseUrl = getSupabaseUrl()
  const supabaseKey = getSupabasePublicKey()

  if (!supabaseUrl || !supabaseKey) {
    return null
  }

  return createBrowserClient(supabaseUrl, supabaseKey)
}
