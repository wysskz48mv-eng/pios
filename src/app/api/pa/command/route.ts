import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })
    return NextResponse.json({
      response: `NemoClaw received: "${message}"`,
      actions: []
    })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
