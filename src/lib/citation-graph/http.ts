type Json = Record<string, unknown>

export class SimpleRateLimiter {
  private nextAllowedAt = 0

  constructor(private readonly intervalMs: number) {}

  async waitTurn() {
    const now = Date.now()
    const waitMs = Math.max(0, this.nextAllowedAt - now)
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
    this.nextAllowedAt = Date.now() + this.intervalMs
  }
}

function isRetryable(status: number) {
  return status === 429 || status >= 500
}

export async function fetchJsonWithRetry<T extends Json = Json>(
  url: string,
  init?: RequestInit,
  options?: {
    retries?: number
    timeoutMs?: number
    backoffMs?: number
    limiter?: SimpleRateLimiter
  },
): Promise<T> {
  const retries = options?.retries ?? 3
  const timeoutMs = options?.timeoutMs ?? 12000
  const backoffMs = options?.backoffMs ?? 500

  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      if (options?.limiter) {
        await options.limiter.waitTurn()
      }

      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        if (attempt < retries && isRetryable(response.status)) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)))
          continue
        }

        const text = await response.text().catch(() => '')
        throw new Error(`Request failed: ${response.status} ${response.statusText} ${text}`.trim())
      }

      return (await response.json()) as T
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)))
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed')
}

export function sanitiseDoi(doi: string): string {
  return doi.trim().replace(/^https?:\/\/doi.org\//i, '')
}
