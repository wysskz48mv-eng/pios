import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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

type DomainMapRow = {
  domain_mode: string
  relevance_score: number
  viq_frameworks: Framework
}

export class FrameworkLoader {
  private supabase: SupabaseClient | null = null

  private getClient(): SupabaseClient {
    if (this.supabase) return this.supabase

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials are not configured for framework library access')
    }

    this.supabase = createClient(supabaseUrl, supabaseKey)
    return this.supabase
  }

  async loadAllFrameworks(): Promise<Framework[]> {
    const { data } = await this.getClient().from('viq_frameworks').select('*').eq('active', true).order('sort_order')
    return data ?? []
  }

  async loadFrameworksByDomain(domainMode: string): Promise<FrameworkWithRelevance[]> {
    const { data } = await this.getClient()
      .from('framework_domain_map')
      .select('domain_mode, relevance_score, viq_frameworks(*)')
      .eq('domain_mode', domainMode)
      .order('relevance_score', { ascending: false })

    return (data as DomainMapRow[] | null)?.map((row) => ({
      ...row.viq_frameworks,
      domain_mode: row.domain_mode,
      relevance_score: row.relevance_score,
    })) ?? []
  }

  async loadFrameworksByCategory(category: string): Promise<Framework[]> {
    const { data } = await this.getClient().from('viq_frameworks').select('*').eq('active', true).eq('category', category).order('sort_order')
    return data ?? []
  }

  async getFrameworkByCode(viqCode: string): Promise<Framework | null> {
    const { data } = await this.getClient().from('viq_frameworks').select('*').eq('viq_code', viqCode).single()
    return data
  }

  async searchFrameworks(query: string): Promise<Framework[]> {
    const q = `%${query}%`
    const { data } = await this.getClient()
      .from('viq_frameworks')
      .select('*')
      .eq('active', true)
      .or(`name.ilike.${q},description.ilike.${q},when_to_use.ilike.${q}`)
      .order('sort_order')
    return data ?? []
  }

  async getFrameworkStats() {
    const { data } = await this.getClient().from('viq_frameworks').select('category').eq('active', true)
    if (!data) return null

    const byCategory: Record<string, number> = {}
    data.forEach((framework: { category: string }) => {
      byCategory[framework.category] = (byCategory[framework.category] || 0) + 1
    })

    return { total: data.length, byCategory }
  }
}

export const frameworkLoader = new FrameworkLoader()

export async function suggestFrameworksForContext(domainMode: string, context: string): Promise<FrameworkWithRelevance[]> {
  const frameworks = await frameworkLoader.loadFrameworksByDomain(domainMode)
  const q = context.toLowerCase()
  return frameworks
    .filter((framework) =>
      framework.description.toLowerCase().includes(q) ||
      framework.when_to_use.toLowerCase().includes(q) ||
      framework.name.toLowerCase().includes(q)
    )
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 5)
}
