import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isPlausibleBetaToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{8,200}$/.test(token)
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() ?? ''
  const plan = request.nextUrl.searchParams.get('plan')?.trim() || 'pro'
  const destination = new URL('/auth/signup', request.url)

  if (!isPlausibleBetaToken(token)) {
    destination.searchParams.set('error', 'invalid_beta_token')
    return NextResponse.redirect(destination)
  }

  destination.searchParams.set('plan', plan)
  destination.searchParams.set('beta', token)

  return NextResponse.redirect(destination)
}