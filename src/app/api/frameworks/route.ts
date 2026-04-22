import { NextRequest, NextResponse } from 'next/server'
import { frameworkLoader } from '@/lib/framework-library/FrameworkLoader'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams

    // Consulting Workbench mode (new)
    const step = p.get('step')
    const active = p.get('active')
    const mode = p.get('mode')

    if (mode === 'consulting' || step !== null || active !== null) {
      const admin = createServiceClient()
      let query = admin.from('framework_library').select('*').order('step_number', { ascending: true }).order('name', { ascending: true })

      if (step !== null) {
        const stepNumber = Number(step)
        if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 7) {
          return NextResponse.json({ error: 'step must be an integer between 1 and 7' }, { status: 400 })
        }
        query = query.eq('step_number', stepNumber)
      }

      if (active !== null) {
        query = query.eq('active', active !== 'false')
      } else {
        query = query.eq('active', true)
      }

      const { data, error } = await query
      if (error) throw error

      return NextResponse.json({ frameworks: data ?? [] })
    }

    // Legacy VIQ framework library mode (existing behavior)
    const domain = p.get('domain')
    const category = p.get('category')
    const search = p.get('search')

    let frameworks
    if (search) frameworks = await frameworkLoader.searchFrameworks(search)
    else if (domain) frameworks = await frameworkLoader.loadFrameworksByDomain(domain)
    else if (category) frameworks = await frameworkLoader.loadFrameworksByCategory(category)
    else frameworks = await frameworkLoader.loadAllFrameworks()

    return NextResponse.json({ frameworks })
  } catch {
    return NextResponse.json({ frameworks: [] })
  }
}
