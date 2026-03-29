import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function GET() {
  return NextResponse.json({ error: 'Microsoft OAuth not yet configured. Contact info@veritasiq.io.' }, { status: 503 })
}
