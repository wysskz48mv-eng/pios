import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude, PIOS_SYSTEM } from '@/lib/ai/client'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = await request.json()
  if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 })

  try {
    const reply = await callClaude(messages, PIOS_SYSTEM, 1200)
    // Track credit usage
    await supabase.rpc('increment_ai_credits', { user_id: user.id, amount: 1 }).maybeSingle()
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('AI chat error:', err)
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500 })
  }
}
