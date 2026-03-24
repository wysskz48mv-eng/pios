/**
 * VeritasIQ Technologies Ltd — API Security Middleware (TypeScript)
 * ==================================================================
 * ISO 27001: A.8.20, A.8.3, A.8.15, A.12.4
 * IS-POL-003, IS-POL-008, IS-POL-015
 *
 * AUDIT LOGS: Write to Supabase audit_log table — ISO 27001 A.12.4 compliant.
 * Console fallback if DB unavailable.
 */
import { NextRequest } from 'next/server'
import crypto from 'crypto'

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /jailbreak/i,
  /system\s+prompt/i,
  /reveal\s+(your\s+)?(instructions|prompt|training)/i,
  /what\s+are\s+your\s+(hidden\s+)?instructions/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /disregard\s+(your|all|the)/i,
  /output\s+(the\s+)?(system|original)\s+prompt/i,
  /\[\s*INST\s*\]|\[\s*\/INST\s*\]/i,
  /<\|(?:im_start|im_end|system|user)\|>/i,
]

const BLOCKED_FIELDS = new Set([
  'cafx_factor', 'cafx_value', 'climate_factor',
  'bench_rate', 'bench_rate_per_sqm', 'hdca_weight',
  'system_prompt', '_internal', 'raw_coefficient',
])

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function validateCsrfToken(token: string | null, expected: string | null): boolean {
  if (!token || !expected || token.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

export interface SecurityCheckResult {
  safe: boolean; reason?: string; category?: 'injection' | 'clean'
}

export function checkPromptSafety(input: string): SecurityCheckResult {
  if (!input || typeof input !== 'string') return { safe: true, category: 'clean' }
  for (const p of INJECTION_PATTERNS) {
    if (p.test(input)) return { safe: false, reason: 'Prompt injection pattern detected.', category: 'injection' }
  }
  return { safe: true, category: 'clean' }
}

export function sanitiseApiResponse<T extends Record<string, unknown>>(data: T): T {
  const out = { ...data }
  for (const f of BLOCKED_FIELDS) delete out[f]
  for (const key of Object.keys(out)) {
    if (key.startsWith('_')) delete out[key]
    else if (out[key] && typeof out[key] === 'object' && !Array.isArray(out[key]))
      out[key] = sanitiseApiResponse(out[key] as Record<string, unknown>) as T[typeof key]
  }
  return out as T
}

/**
 * ISO 27001 A.12.4 — Write to Supabase audit_log table.
 * Falls back to console if DB unavailable. Never throws.
 */
export async function auditLog(
  req: NextRequest | Request | null,
  params: {
    userId?:  string
    action:   string
    detail?:  string | Record<string, unknown>
    risk?:    'low' | 'medium' | 'high'
    [key: string]: unknown
  }
): Promise<void> {
  const ip = req
    ? String((req.headers as Record<string, unknown>).get?.('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
    : 'server'
  const ua = req
    ? String((req.headers as Record<string, unknown>).get?.('user-agent') ?? '').slice(0, 200)
    : 'server'

  const entry = {
    user_id:    params.userId ?? null,
    action:     params.action,
    ip_address: ip,
    user_agent: ua,
    metadata:   {
      ...(typeof params.detail === 'object' ? params.detail : { detail: params.detail }),
      risk: params.risk ?? 'low',
      ts:   new Date().toISOString(),
    },
  }

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = createClient()
    await supabase.from('audit_log').insert(entry)
  } catch {
    console.log('[AUDIT]', JSON.stringify({ ...entry, _fallback: true }))
  }
}

export const IP_HEADERS = {
  'X-IP-Notice':     '\u00A9 2026 VeritasIQ Technologies Ltd. Proprietary and confidential.',
  'X-Content-Owner': 'VeritasIQ Technologies Ltd',
  'Cache-Control':   'no-store, no-cache, must-revalidate',
  'X-Robots-Tag':    'noindex',
} as const
