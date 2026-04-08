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
 *  5. Provider resilience — Anthropic primary with OpenAI/Gemini failover
 */

import { completeWithFailover } from '@/lib/ai/provider'

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

/** Supported model shortcuts */
export const MODELS = {
  sonnet: 'claude-sonnet-4-20250514',
  haiku:  'claude-haiku-4-5-20251001',
} as const

export type ModelKey = keyof typeof MODELS

export async function callClaude(
  messages: AIMessage[],
  system: string,
  maxTokens = 1000,
  model: ModelKey = 'sonnet'
): Promise<string> {
  const response = await completeWithFailover({
    system,
    messages: sanitise(messages),
    maxTokens,
    temperature: 0.2,
    preferredModel: MODELS[model],
  })

  // Audit log (IS-POL-015)
  console.info(
    '[PIOS-AI] provider=%s model=%s failover=%s tokens in=%d out=%d',
    response.provider,
    response.model,
    response.failoverOccurred,
    response.tokens.input,
    response.tokens.output,
  )

  return filterOutput(response.content)
}

// PIOS system prompt — INTERNAL classification (IS-POL-004)
// Do not log, expose in API responses, or transmit to client
export const PIOS_SYSTEM = `You are PIOS AI — the intelligent companion for the Personal Intelligent Operating System. You support the user across their professional domains: academic research, FM consulting, SaaS product management, and business operations.

You are concise, direct, and action-oriented. You surface what matters, flag cross-domain conflicts, and help the user make decisions. You never pad responses with unnecessary pleasantries. When you identify a risk or conflict, you say so clearly.`
