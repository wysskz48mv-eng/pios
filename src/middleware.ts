import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cs: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cs.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cs.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (!user && path.startsWith('/platform')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  if (user && path === '/auth/login') {
    return NextResponse.redirect(new URL('/platform/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook).*)'],
}
