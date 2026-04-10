import { NextResponse } from 'next/server'

/**
 * Return a safe error response that never leaks internal details in production.
 */
export function apiError(err: unknown, status = 500): NextResponse {
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Internal server error'

  return NextResponse.json({ error: message }, { status })
}
