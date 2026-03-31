/**
 * GET /api/integrations/gmail/connect
 * Redirects to the actual Gmail connect endpoint
 * PIOS · VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const redirect = req.nextUrl.searchParams.get('redirect') || '/platform/email'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  return NextResponse.redirect(new URL(`/api/auth/connect-gmail?redirect=${encodeURIComponent(redirect)}`, appUrl))
}
