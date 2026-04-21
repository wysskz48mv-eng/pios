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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!serviceKey) {
    throw new Error('Missing Supabase service role key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY)')
  }

  return createServerClient(
    getSupabaseUrl(),
    serviceKey,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
