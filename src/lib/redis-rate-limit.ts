/**
 * Redis-backed rate limiting with in-memory fallback
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL is set,
 * falls back to in-memory Map (single instance) otherwise.
 *
 * ISO 27001 A.12.6 — Technical vulnerability management
 * VeritasIQ Technologies Ltd | Sprint 49
 *
 * Setup:
 *   1. Create free Upstash Redis at upstash.com
 *   2. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel
 *   3. No code changes needed — auto-detects and switches
 */

interface RLResult { success: boolean; remaining: number; resetAt: number }

// ── In-memory fallback ────────────────────────────────────────────────────────
const memStore = new Map<string, { count: number; resetAt: number }>()
setInterval(() => {
  const now = Date.now()
  for (const [k, e] of Array.from(memStore.entries())) if (e.resetAt < now) memStore.delete(k)
}, 5 * 60 * 1000)

function memRateLimit(key: string, max: number, windowMs: number): RLResult {
  const now    = Date.now()
  const resetAt = now + windowMs
  const entry  = memStore.get(key)
  if (!entry || entry.resetAt < now) {
    memStore.set(key, { count: 1, resetAt })
    return { success: true, remaining: max - 1, resetAt }
  }
  if (entry.count >= max) return { success: false, remaining: 0, resetAt: entry.resetAt }
  entry.count++
  return { success: true, remaining: max - entry.count, resetAt: entry.resetAt }
}

// ── Upstash Redis via REST API (no SDK needed) ────────────────────────────────
async function redisRateLimit(key: string, max: number, windowSec: number): Promise<RLResult> {
  const url   = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!

  // INCR then EXPIRE — atomic enough for rate limiting
  const incr = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()) as { result: number }

  if (incr.result === 1) {
    // First request in window — set expiry
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${windowSec}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  const ttl = await fetch(`${url}/ttl/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()) as { result: number }

  const resetAt = Date.now() + (ttl.result > 0 ? ttl.result * 1000 : windowSec * 1000)
  const count   = incr.result

  return {
    success:   count <= max,
    remaining: Math.max(0, max - count),
    resetAt,
  }
}

// ── Unified rate limiter ──────────────────────────────────────────────────────
export async function rateLimit(params: {
  key:       string   // e.g. `auth:${ip}` or `ai:${userId}`
  max:       number
  windowMs:  number
}): Promise<RLResult> {
  const { key, max, windowMs } = params
  const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

  if (useRedis) {
    try {
      return await redisRateLimit(key, max, Math.ceil(windowMs / 1000))
    } catch {
      // Redis unavailable — fall through to in-memory
    }
  }

  return memRateLimit(key, max, windowMs)
}

/**
 * Returns a 429 Response if rate limit exceeded, null if ok.
 * Drop-in replacement for existing rate limit helpers.
 */
export async function checkRateLimit(params: {
  key:      string
  max:      number
  windowMs: number
}): Promise<Response | null> {
  const result = await rateLimit(params)
  if (result.success) return null
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
  return new Response(
    JSON.stringify({ error: 'Too many requests', retryAfter }),
    {
      status: 429,
      headers: {
        'Content-Type':          'application/json',
        'Retry-After':           String(retryAfter),
        'X-RateLimit-Limit':     String(params.max),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset':     String(Math.ceil(result.resetAt / 1000)),
      },
    }
  )
}

export const LIMITS = {
  auth:        { max: 10,  windowMs: 15 * 60 * 1000  },
  register:    { max: 5,   windowMs: 60 * 60 * 1000  },
  passwordReset:{ max: 3,  windowMs: 60 * 60 * 1000  },
  ai:          { max: 20,  windowMs: 60 * 1000        },
  api:         { max: 60,  windowMs: 60 * 1000        },
  admin:       { max: 30,  windowMs: 60 * 1000        },
}
