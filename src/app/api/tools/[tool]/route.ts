import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runNemoclawTool } from '@/lib/nemoclaw/tool-registry'

export const runtime = 'nodejs'

function parseValue(value: string): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  const maybeNum = Number(value)
  if (!Number.isNaN(maybeNum) && String(maybeNum) === value) return maybeNum
  return value
}

export async function GET(request: NextRequest, context: { params: Promise<{ tool: string }> }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = await context.params
    const tool = params.tool
    const input: Record<string, unknown> = {}

    request.nextUrl.searchParams.forEach((value, key) => {
      input[key] = parseValue(value)
    })

    const result = await runNemoclawTool(supabase, user.id, tool, input)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ tool: string }> }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = await context.params
    const tool = params.tool
    const body = await request.json().catch(() => ({}))

    const result = await runNemoclawTool(supabase, user.id, tool, body as Record<string, unknown>)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
