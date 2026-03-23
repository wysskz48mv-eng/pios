/**
 * VeritasIQ Technologies Ltd — API Security Middleware (TypeScript)
 * ==================================================================
 * ISO 27001: A.8.20, A.8.3, A.8.15
 * IS-POL-003 (Access Control), IS-POL-008 (SSDLC), IS-POL-015 (Transfer)
 *
 * Use in API routes:
 *   import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'
 */

// ── Prompt injection patterns (IS-POL-008 — AI route security) ───────────────
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /jailbreak/i,
  /system\s+prompt/i,
  /reveal\s+(your\s+)?(instructions|prompt|training)/i,
  /what\s+are\s+your\s+(hidden\s+)?instructions/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+(if\s+you\s+are\s+)?(?!a\s+journalist)/i,
  /disregard\s+(your|all|the)/i,
  /output\s+(the\s+)?(system|original)\s+prompt/i,
]

// ── Fields that must never appear in API responses (IS-POL-004 TRADE SECRET) ─
const BLOCKED_RESPONSE_FIELDS = [
  'cafx_factor', 'cafx_value', 'climate_factor',
  'bench_rate', 'bench_rate_per_sqm', 'benchmark_rate',
  'hdca_weight', 'hdca_usage', 'usage_weight',
  'astax_code', 'system_prompt', '_internal',
  'raw_coefficient', 'calibration_value',
]

export interface SecurityCheckResult {
  safe: boolean
  reason?: string
  category?: 'injection' | 'ip_extraction' | 'clean'
}

/**
 * Check user input for prompt injection attempts.
 * Use on ALL API routes that pass user content to Claude.
 */
export function checkPromptSafety(input: string): SecurityCheckResult {
  if (!input || typeof input !== 'string') return { safe: true, category: 'clean' }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        safe: false,
        reason: 'Input contains patterns associated with prompt injection.',
        category: 'injection',
      }
    }
  }
  return { safe: true, category: 'clean' }
}

/**
 * Strip trade secret fields from any API response object.
 * Use before returning any AI-computed result.
 */
export function sanitiseApiResponse<T extends Record<string, unknown>>(data: T): T {
  const sanitised = { ...data }
  for (const field of BLOCKED_RESPONSE_FIELDS) {
    if (field in sanitised) {
      delete sanitised[field]
    }
    // Also remove nested _internal objects
    for (const key of Object.keys(sanitised)) {
      if (key.startsWith('_') && typeof sanitised[key] === 'object') {
        delete sanitised[key]
      }
    }
  }
  return sanitised as T
}

/**
 * Log API access for ISO 27001 audit trail (IS-POL-003, A.8.15).
 * Call at the start of sensitive API routes.
 */
export function auditLog(params: {
  userId: string | undefined
  action: string
  resource: string
  ip: string
  riskLevel?: 'low' | 'medium' | 'high'
}): void {
  const entry = {
    ts: new Date().toISOString(),
    userId: params.userId ?? 'anonymous',
    action: params.action,
    resource: params.resource,
    ip: params.ip,
    risk: params.riskLevel ?? 'low',
  }
  // In production: write to security_events table in Supabase
  // For now: structured console log (picked up by Vercel log drain)
  console.log('[AUDIT]', JSON.stringify(entry))
}

/**
 * Standard IP ownership headers for all API responses.
 * Add to NextResponse headers on sensitive endpoints.
 */
export const IP_HEADERS = {
  'X-IP-Notice':     '\u00A9 2026 VeritasIQ Technologies Ltd. Proprietary and confidential.',
  'X-Content-Owner': 'VeritasIQ Technologies Ltd',
  'Cache-Control':   'no-store, no-cache, must-revalidate',
  'X-Robots-Tag':    'noindex',
} as const
