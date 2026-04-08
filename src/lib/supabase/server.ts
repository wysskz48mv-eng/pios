import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicKey, getSupabaseUrl } from '@/lib/supabase/env'

export function createClient() {
  return createServerClient(
    getSupabaseUrl(),
    getSupabasePublicKey(),
    {
      cookies: {
        async getAll() {
          const cookieStore = await cookies()
          return cookieStore.getAll()
        },
        async setAll(cs: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            const cookieStore = await cookies()
            cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options as Record<string, unknown>))
          } catch {}
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
