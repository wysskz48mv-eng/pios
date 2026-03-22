/**
 * PIOS Monitoring — DSN-gated error tracking
 * Only active when SENTRY_DSN environment variable is set.
 * PIOS v1.0 | VeritasIQ Technologies Ltd
 */
type ErrorCtx = Record<string, string | number | boolean | null | undefined>

let initialized = false, Sentry: any = null

async function getSentry() {
  if (initialized) return Sentry
  initialized = true
  if (!process.env.SENTRY_DSN) return null
  try {
    // @ts-ignore
    Sentry = await import('@sentry/nextjs').catch(() => null)
    if (Sentry && !Sentry.isInitialized?.()) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV ?? 'production',
        release: 'pios@1.0',
        tracesSampleRate: 0.1,
        beforeSend(e: any) { if (e.user) { delete e.user.email; delete e.user.ip_address }; return e },
      })
    }
    return Sentry
  } catch { return null }
}

export async function captureError(error: unknown, context?: ErrorCtx) {
  console.error('[PIOS]', error, context ?? '')
  const s = await getSentry(); if (!s) return
  s.withScope((scope: any) => {
    if (context) scope.setExtras(context)
    scope.setTag('product', 'pios')
    s.captureException(error)
  })
}
