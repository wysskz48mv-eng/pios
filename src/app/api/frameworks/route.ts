import { NextRequest, NextResponse } from 'next/server'
import { frameworkLoader } from '@/lib/framework-library/FrameworkLoader'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams
    const domain = p.get('domain')
    const category = p.get('category')
    const search = p.get('search')

    let frameworks
    if (search) frameworks = await frameworkLoader.searchFrameworks(search)
    else if (domain) frameworks = await frameworkLoader.loadFrameworksByDomain(domain)
    else if (category) frameworks = await frameworkLoader.loadFrameworksByCategory(category)
    else frameworks = await frameworkLoader.loadAllFrameworks()

    return NextResponse.json({ frameworks })
  } catch { return NextResponse.json({ frameworks: [] }) }
}
