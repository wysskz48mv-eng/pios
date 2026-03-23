/**
 * PIOS™ — AI client with security wrapper
 * ========================================
 * VeritasIQ Technologies Ltd
 *
 * ISO 27001: IS-POL-008 (SSDLC), IS-POL-004 (Trade Secret)
 * IS-POL-015: System prompts are INTERNAL — never logged to external services
 *
 * Security controls:
 *  1. Input sanitisation — null bytes stripped, length capped
 *  2. Output filter — detects and suppresses system prompt leakage
 *  3. Temperature capped at 0.7
 *  4. Token usage logged for audit and cost monitoring
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

export interface AIMessage { role: 'user' | 'assistant'; content: string }

// Patterns that indicate possible system prompt leakage
const LEAK_PATTERNS = [
  /you are an? (ai|assistant|language model)/i,
  /my (system )?instructions/i,
  /i('m| am) claude/i,
  /as an? (ai|llm)/i,
]

function sanitise(messages: AIMessage[]): AIMessage[] {
  return messages.map(m => ({
    ...m,
    content: m.content.replace(/\0/g, '').slice(0, 40_000).trim(),
  }))
}

function filterOutput(text: string): string {
  for (const p of LEAK_PATTERNS) {
    if (p.test(text)) {
      console.warn('[PIOS-AI] Output filter: potential system prompt leak suppressed')
      return text.replace(p, '[filtered]')
    }
  }
  return text
}

export async function callClaude(
  messages: AIMessage[],
  system: string,
  maxTokens = 1000
): Promise<string> {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature: 0.2,   // deterministic for factual/operational tasks
      system,             // server-side only
      messages: sanitise(messages),
    }),
  })

  if (!res.ok) {
    console.error('[PIOS-AI] Claude API error', res.status)
    throw new Error(`AI service error: ${res.status}`)
  }

  const data = await res.json()
  const raw  = data.content?.[0]?.text ?? ''

  // Audit log (IS-POL-015)
  console.info('[PIOS-AI] tokens in=%d out=%d',
    data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0)

  return filterOutput(raw)
}

// PIOS system prompt — INTERNAL classification (IS-POL-004)
// Do not log, expose in API responses, or transmit to client
export const PIOS_SYSTEM = `You are PIOS AI — the intelligent companion for the Personal Intelligent Operating System. You support the user across their professional domains: academic research, FM consulting, SaaS product management, and business operations.

You are concise, direct, and action-oriented. You surface what matters, flag cross-domain conflicts, and help the user make decisions. You never pad responses with unnecessary pleasantries. When you identify a risk or conflict, you say so clearly.`
