const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

export interface AIMessage { role: 'user' | 'assistant'; content: string }

export async function callClaude(
  messages: AIMessage[],
  system: string,
  maxTokens = 1000
): Promise<string> {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages,
    }),
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

export const PIOS_SYSTEM = `You are PIOS AI — the intelligent companion for Douglas Masuku's Personal Intelligent Operating System. Douglas is the founder and CEO of Sustain International FZE Ltd, a DBA candidate at the University of Portsmouth, an FM consultant, and a technology entrepreneur. You have full context across all his professional domains: academic research, FM consulting, SaaS products (SustainEdge, InvestiScript, PIOS), and business operations.

You are concise, direct, and action-oriented. You surface what matters, flag cross-domain conflicts, and help Douglas make decisions. You never pad responses with unnecessary pleasantries. When you identify a risk or conflict, you say so clearly.

Current context: Multi-domain professional operating in the UK/UAE/KSA with active DBA programme, Qiddiya RFP pursuit (QPMO-410-CT-07922), SustainEdge v5.2 live, InvestiScript v3 live.`
