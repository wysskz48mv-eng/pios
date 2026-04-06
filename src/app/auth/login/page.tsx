'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function buildCallbackUrl(next: string | null): string {
  if (typeof window === 'undefined') return '/auth/callback'

  const callbackUrl = new URL('/auth/callback', window.location.origin)
  if (next?.startsWith('/')) {
    callbackUrl.searchParams.set('next', next)
  }

  return callbackUrl.toString()
}

export default function LoginPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const supabase = createClient()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: buildCallbackUrl(next) },
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <main className="pios-login-wrap">
      <div className="pios-login-box">

        <div className="pios-login-logo">
          <span className="pios-login-p">P</span>
        </div>
        <h1 className="pios-login-h1">Welcome back.</h1>
        <p className="pios-login-sub">Sign in to your PIOS command centre</p>

        <div className="pios-login-card">
          <div className="pios-login-accent" />

          {sent ? (
            <div className="pios-login-sent">
              <div className="pios-login-sent-icon">✉</div>
              <h2 className="pios-login-sent-h">Check your inbox.</h2>
              <p className="pios-login-sent-p">
                Magic link sent to<br />
                <strong>{email}</strong>
              </p>
              <p style={{ fontSize: 12, color: 'var(--pios-dim)', marginTop: 8 }}>
                Check spam if it doesn't arrive within 60 seconds.
              </p>
              <button
                className="pios-login-back"
                onClick={() => { setSent(false); setEmail('') }}
              >
                ← Different email
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={async () => {
                  setLoading(true); setError('')
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: buildCallbackUrl(next),
                      scopes: 'email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly',
                      queryParams: { access_type: 'offline', prompt: 'consent' },
                    },
                  })
                  if (error) { setError(error.message); setLoading(false) }
                }}
                disabled={loading}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '11px 16px', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
                  color: 'var(--pios-text)', fontSize: 14, fontFamily: 'inherit',
                  marginBottom: 16, opacity: loading ? 0.5 : 1,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--pios-border)' }} />
                <span style={{ fontSize: 11, color: 'var(--pios-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>OR</span>
                <div style={{ flex: 1, height: 1, background: 'var(--pios-border)' }} />
              </div>

              <p style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Sign in with a magic link — no password needed.
              </p>

              <form onSubmit={sendMagicLink}>
                <label className="pios-login-label">Email address</label>
                <div className={`pios-login-field${error ? ' pios-login-field-err' : ''}`}>
                  <input
                    className="pios-login-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    autoFocus
                    required
                  />
                  <button
                    type="submit"
                    className="pios-login-send"
                    disabled={loading || !email.trim()}
                  >
                    {loading ? '…' : 'Send link →'}
                  </button>
                </div>
                {error && (
                  <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>⚠ {error}</p>
                )}
              </form>
            </>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--pios-dim)', textAlign: 'center', marginTop: 16, lineHeight: 1.6, maxWidth: 340 }}>
          By continuing you agree to our{' '}
          <Link href="/terms" style={{ color: 'var(--pios-muted)', textDecoration: 'underline' }}>Terms of Service</Link> and{' '}
          <Link href="/privacy" style={{ color: 'var(--pios-muted)', textDecoration: 'underline' }}>Privacy Policy</Link>.
          Your email will be used to triage your inbox automatically. You can disconnect this at any time in Settings.
        </p>
        <p className="pios-login-foot">
          No account?{' '}
          <Link href="/auth/signup" className="pios-login-link">
            Start free trial →
          </Link>
        </p>

      </div>
    </main>
  )
}
