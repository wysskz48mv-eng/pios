import { createClient } from '@supabase/supabase-js'

export interface Framework {
  id: string
  viq_code: string
  name: string
  category: string
  description: string
  when_to_use: string
  domain_tags: string[]
  tier: string
  sort_order: number
}

export interface FrameworkWithRelevance extends Framework {
  domain_mode: string
  relevance_score: number
}

export class FrameworkLoader {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async loadAllFrameworks(): Promise<Framework[]> {
    const { data } = await this.supabase
      .from('viq_frameworks').select('*').eq('active', true).order('sort_order')
    return data ?? []
  }

  async loadFrameworksByDomain(domainMode: string): Promise<FrameworkWithRelevance[]> {
    const { data } = await this.supabase
      .from('framework_domain_map')
      .select('*, viq_frameworks(*)')
      .eq('domain_mode', domainMode)
      .order('relevance_score', { ascending: false })
    return (data ?? []).map((d: any) => ({
      ...d.viq_frameworks,
      domain_mode: d.domain_mode,
      relevance_score: d.relevance_score,
    }))
  }

  async loadFrameworksByCategory(category: string): Promise<Framework[]> {
    const { data } = await this.supabase
      .from('viq_frameworks').select('*').eq('active', true).eq('category', category).order('sort_order')
    return data ?? []
  }

  async getFrameworkByCode(viqCode: string): Promise<Framework | null> {
    const { data } = await this.supabase
      .from('viq_frameworks').select('*').eq('viq_code', viqCode).single()
    return data
  }

  async searchFrameworks(query: string): Promise<Framework[]> {
    const q = `%${query}%`
    const { data } = await this.supabase
      .from('viq_frameworks').select('*').eq('active', true)
      .or(`name.ilike.${q},description.ilike.${q},when_to_use.ilike.${q}`)
      .order('sort_order')
    return data ?? []
  }

  async getFrameworkStats() {
    const { data } = await this.supabase
      .from('viq_frameworks').select('category').eq('active', true)
    if (!data) return null
    const byCategory: Record<string, number> = {}
    data.forEach(f => { byCategory[f.category] = (byCategory[f.category] || 0) + 1 })
    return { total: data.length, byCategory }
  }
}

export const frameworkLoader = new FrameworkLoader()

export async function suggestFrameworksForContext(domainMode: string, context: string): Promise<FrameworkWithRelevance[]> {
  const frameworks = await frameworkLoader.loadFrameworksByDomain(domainMode)
  const q = context.toLowerCase()
  return frameworks
    .filter(f => f.description.toLowerCase().includes(q) || f.when_to_use.toLowerCase().includes(q) || f.name.toLowerCase().includes(q))
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 5)
}
