import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { frameworkLoader } from '@/lib/framework-library/FrameworkLoader'

export const runtime = 'nodejs'

type RouteParams = { code: string }

export async function GET(_req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { code } = await context.params
    const frameworkCode = String(code ?? '').trim()
    if (!frameworkCode) {
      return NextResponse.json({ error: 'Framework code is required' }, { status: 400 })
    }

    const admin = createServiceClient()
    const { data, error } = await admin
      .from('framework_library')
      .select('*')
      .eq('code', frameworkCode.toUpperCase())
      .maybeSingle()

    if (error) throw error
    if (data) {
      return NextResponse.json({ framework: data })
    }

    // Legacy fallback: VIQ framework code lookup.
    const legacy = await frameworkLoader.getFrameworkByCode(frameworkCode)
    if (legacy) {
      return NextResponse.json({ framework: legacy })
    }

    return NextResponse.json({ error: 'Framework not found' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch framework' }, { status: 500 })
  }
}
