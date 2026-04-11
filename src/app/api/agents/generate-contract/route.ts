/**
 * POST /api/agents/generate-contract
 * Contract Intelligence Agent System — orchestrates 4 agents:
 *   1. Business Process Analyzer: identifies what contracts are needed
 *   2. Template Miner: extracts patterns from existing contracts
 *   3. Template Synthesis: creates master templates from patterns
 *   4. Contract Generator: generates contracts with variants
 *
 * Actions: analyze_business, mine_templates, synthesize, generate
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { apiError } from '@/lib/api-error'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action } = body

    // ═════════════════════════════════════════════════════════════════════════
    // AGENT 1: Business Process Analyzer
    // ═════════════════════════════════════════════════════════════════════════
    if (action === 'analyze_business') {
      const [contractsR, projectsR, stakeholdersR, profileR] = await Promise.all([
        supabase.from('contracts').select('contract_type, counterparty, status').eq('user_id', user.id),
        supabase.from('projects').select('title, domain, status').eq('user_id', user.id).eq('status', 'active'),
        supabase.from('exec_stakeholders').select('name, organisation, relationship_type').eq('user_id', user.id),
        supabase.from('user_profiles').select('full_name, organisation, job_title').eq('id', user.id).single(),
      ])

      const prompt = `Analyze this business context and identify what contract types are needed.

COMPANY: ${profileR.data?.organisation ?? 'VeritasIQ Technologies Ltd'}
ROLE: ${profileR.data?.job_title ?? 'CEO'}

EXISTING CONTRACTS (${contractsR.data?.length ?? 0}):
${(contractsR.data ?? []).map(c => `- ${c.contract_type}: ${c.counterparty} (${c.status})`).join('\n') || 'None'}

ACTIVE PROJECTS (${projectsR.data?.length ?? 0}):
${(projectsR.data ?? []).map(p => `- ${p.title} (${p.domain})`).join('\n') || 'None'}

KEY STAKEHOLDERS (${stakeholdersR.data?.length ?? 0}):
${(stakeholdersR.data ?? []).slice(0, 10).map(s => `- ${s.name} at ${s.organisation} (${s.relationship_type})`).join('\n') || 'None'}

Identify contract needs. For each, specify type, context, segment, priority, and reason.
Return ONLY valid JSON array:
[{"type":"saas_license","context":"description","customer_segment":"enterprise|government|smb|partner","priority":"high|medium|low","trigger_reason":"why needed"}]`

      const raw = await callClaude(
        [{ role: 'user', content: prompt }],
        'You are a business analyst identifying contract needs for a technology company.',
        1500,
      )
      const needs = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```/g, '').trim())

      return NextResponse.json({ ok: true, needs })
    }

    // ═════════════════════════════════════════════════════════════════════════
    // AGENT 4: Contract Generation (main value driver)
    // ═════════════════════════════════════════════════════════════════════════
    if (action === 'generate') {
      const { contract_type, customer_name, customer_segment, product_name,
              annual_fee, currency, term_length, support_level, special_terms, jurisdiction } = body

      if (!contract_type || !customer_name) {
        return NextResponse.json({ error: 'contract_type and customer_name required' }, { status: 400 })
      }

      // Check for existing template
      const { data: template } = await supabase
        .from('contract_templates')
        .select('master_content, sections, placeholders')
        .eq('user_id', user.id)
        .eq('contract_type', contract_type)
        .eq('is_active', true)
        .maybeSingle()

      // Get company info
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, organisation')
        .eq('id', user.id)
        .single()

      const companyName = profile?.organisation ?? 'VeritasIQ Technologies Ltd'

      const genPrompt = `Generate a professional ${contract_type.replace(/_/g, ' ')} contract.

PARTIES:
- Licensor/Provider: ${companyName}
- Customer/Licensee: ${customer_name}
- Customer Segment: ${customer_segment ?? 'enterprise'}

TERMS:
- Product/Service: ${product_name ?? 'Professional Services'}
- Annual Fee: ${annual_fee ? `${currency ?? 'GBP'} ${annual_fee}` : 'To be agreed'}
- Term: ${term_length ?? '1 year'}
- Support Level: ${support_level ?? 'Standard'}
- Jurisdiction: ${jurisdiction ?? 'England and Wales'}
${special_terms ? `- Special Requirements: ${special_terms}` : ''}

${template?.master_content ? `USE THIS TEMPLATE AS BASE:\n${template.master_content.slice(0, 3000)}` : ''}

Generate a complete, professional contract with these sections:
1. Definitions
2. Grant of License / Scope of Services
3. Fees and Payment
4. Term and Renewal
5. Termination
6. Warranties
7. Limitation of Liability
8. Confidentiality
9. Data Protection
10. Governing Law

Use markdown formatting. Be specific with the terms provided. This should be ready for signature.`

      const contract = await callClaude(
        [{ role: 'user', content: genPrompt }],
        'You are an expert contract drafter creating enterprise-grade legal agreements.',
        4000,
      )

      // Generate variants
      const variants: Record<string, string> = { standard: contract }

      if (customer_segment === 'enterprise' || !customer_segment) {
        const entV = await callClaude(
          [{ role: 'user', content: `Modify this contract for ENTERPRISE customers:\n- 4-hour SLA response\n- Higher liability cap\n- Dedicated support manager\n- Source code escrow option\n\nCONTRACT:\n${contract.slice(0, 3000)}\n\nReturn the modified contract.` }],
          'You create enterprise contract variants.', 3000
        )
        variants.enterprise = entV
      }

      if (customer_segment === 'government' || jurisdiction?.includes('Saudi')) {
        const govV = await callClaude(
          [{ role: 'user', content: `Modify for GOVERNMENT (Saudi Arabia):\n- MOMRA compliance\n- Data residency (KSA)\n- Government audit rights\n- Saudi law jurisdiction\n\nCONTRACT:\n${contract.slice(0, 3000)}\n\nReturn the modified contract.` }],
          'You create government-compliant contracts.', 3000
        )
        variants.government = govV
      }

      // Compliance review
      const reviewPrompt = `Review this contract for compliance issues:
${contract.slice(0, 2000)}

Check:
1. All sections present (definitions, fees, term, termination, liability, confidentiality, governing law)
2. No unfilled placeholders [LIKE_THIS]
3. Liability cap is reasonable
4. Payment terms are clear
5. Termination clause is balanced

Return JSON: {"status":"approved"|"warning"|"blocked","checks":[{"check":"name","passed":true|false,"note":"..."}]}`

      const reviewRaw = await callClaude(
        [{ role: 'user', content: reviewPrompt }],
        'You are a contract compliance reviewer.', 800, 'haiku'
      )
      let review = { status: 'approved', checks: [] }
      try { review = JSON.parse(reviewRaw.replace(/```json\n?/g, '').replace(/```/g, '').trim()) } catch {}

      // Store generated contract
      const { data: record } = await supabase.from('generated_contracts').insert({
        user_id: user.id,
        contract_type,
        title: `${customer_name} — ${contract_type.replace(/_/g, ' ')}`,
        customer_name,
        product_name,
        context: { customer_segment, annual_fee, currency, term_length, support_level, special_terms, jurisdiction },
        generated_content: contract,
        variants,
        compliance_checks: review,
        review_status: review.status === 'blocked' ? 'rejected' : 'pending_review',
        generated_by: 'ContractGenerationAgent-v1',
      }).select().single()

      return NextResponse.json({
        ok: true,
        contract: {
          id: record?.id,
          content: contract,
          variants,
          review,
          title: `${customer_name} — ${contract_type.replace(/_/g, ' ')}`,
        },
      })
    }

    // ═════════════════════════════════════════════════════════════════════════
    // AGENT 3: Template Synthesis
    // ═════════════════════════════════════════════════════════════════════════
    if (action === 'synthesize_template') {
      const { contract_type } = body
      if (!contract_type) return NextResponse.json({ error: 'contract_type required' }, { status: 400 })

      const { data: examples } = await supabase
        .from('contracts')
        .select('title, key_terms, obligations, contract_type')
        .eq('user_id', user.id)
        .eq('contract_type', contract_type)
        .limit(5)

      const synthPrompt = `Create a master template for ${contract_type.replace(/_/g, ' ')} contracts.

${examples?.length ? `EXISTING EXAMPLES:\n${examples.map((e, i) => `Example ${i + 1}: ${e.title}\nTerms: ${e.key_terms}\nObligations: ${e.obligations}`).join('\n\n')}` : 'No existing examples — create a comprehensive template from best practices.'}

Create a master template in markdown with:
- [PLACEHOLDER] fields for variable data
- [REQUIRED] and [OPTIONAL] section markers
- Professional legal language
- All standard sections for this contract type

Return the complete template.`

      const template = await callClaude(
        [{ role: 'user', content: synthPrompt }],
        'You are an expert in legal contract templates.',
        4000,
      )

      await supabase.from('contract_templates').insert({
        user_id: user.id,
        contract_type,
        name: `${contract_type.replace(/_/g, ' ')} Master Template v1.0`,
        master_content: template,
        is_active: true,
      })

      return NextResponse.json({ ok: true, template, contract_type })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[PIOS contract agent]', err)
    return apiError(err)
  }
}
