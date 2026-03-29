import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {  
    return NextResponse.json({ error: 'Microsoft OAuth not yet configured. Contact info@veritasiq.io.' }, { status: 503 })
  
  } catch (err: any) {
    console.error('[PIOS]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
