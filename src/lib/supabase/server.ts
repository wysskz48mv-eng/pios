import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicKey, getSupabaseUrl } from '@/lib/supabase/env'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    getSupabaseUrl(),
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cs: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options as Record<string, unknown>)) } catch {}
        },
      } as CookieMethodsServer,
    }
  )
}

export function createServiceClient() {
  return createServerClient(
    getSupabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
