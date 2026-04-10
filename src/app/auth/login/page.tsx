'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildGoogleOAuthOptions } from '@/lib/auth/google-oauth'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import styles from './login.module.css'

function buildCallbackUrl(next: string | null): string {
  if (typeof window === 'undefined') return '/auth/callback'
  const callbackUrl = new URL('/auth/callback', window.location.origin)
  if (next?.startsWith('/')) callbackUrl.searchParams.set('next', next)
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
    if (!supabase) {
      setError('PIOS is temporarily unavailable. Please refresh in a moment.')
      return
    }
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
    <main className={styles.page}>
      <Link href="/" className={styles.backLink}>Back to home</Link>

      <div className={styles.box}>
        <div className={styles.logo}>PIOS</div>

        {sent ? (
          <>
            <div className={styles.sentIcon}>&#9993;</div>
            <h1 className={styles.sentTitle}>Check your inbox.</h1>
            <p className={styles.sentSub}>
              A sign-in link has been sent to<br />
              <strong>{email}</strong>
            </p>
            <p className={styles.sentNote}>
              Check spam if it doesn't arrive within 60 seconds.
            </p>
            <div style={{ textAlign: 'center' }}>
              <button className={styles.backBtn} onClick={() => { setSent(false); setEmail('') }}>
                Use a different email
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Welcome back.</h1>
            <p className={styles.sub}>Sign in to your command centre</p>

            <button
              className={styles.googleBtn}
              onClick={async () => {
                if (!supabase) {
                  setError('PIOS is temporarily unavailable.')
                  return
                }
                setLoading(true); setError('')
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: buildGoogleOAuthOptions(window.location.origin, next, 'auth'),
                })
                if (error) { setError(error.message); setLoading(false) }
              }}
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>

            <div className={styles.divider}>
              <span className={styles.dividerText}>or</span>
            </div>

            <p className={styles.magicNote}>
              Sign in with a magic link — no password needed.
            </p>

            <form onSubmit={sendMagicLink}>
              <label className={styles.fieldLabel}>Email address</label>
              <div className={`${styles.fieldRow}${error ? ` ${styles.fieldRowErr}` : ''}`}>
                <input
                  className={styles.emailInput}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  autoFocus
                  required
                />
                <button type="submit" className={styles.sendBtn} disabled={loading || !email.trim()}>
                  {loading ? '...' : 'Send link'}
                </button>
              </div>
              {error && <p className={styles.errorMsg}>{error}</p>}
            </form>

            <p className={styles.terms}>
              By continuing you agree to our{' '}
              <Link href="/terms">Terms of Service</Link> and{' '}
              <Link href="/privacy">Privacy Policy</Link>.
              <br />
              Gmail, Calendar, and Drive connect after sign-in.
            </p>

            <p className={styles.signupNote}>
              No account?{' '}
              <Link href="/auth/signup" className={styles.signupLink}>Start free trial</Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
