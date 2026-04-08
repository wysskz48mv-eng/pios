'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildGoogleOAuthOptions } from '@/lib/auth/google-oauth'
import Link from 'next/link'
import styles from './signup.module.css'

const PERSONA_LABELS: Record<string, string> = {
  executive: 'Executive · CEO / Founder',
  pro: 'Professional · Consultant',
  starter: 'Starter · Researcher / Student',
  enterprise: 'Enterprise',
}

export default function SignupPage() {
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') ?? 'pro'
  const betaToken = searchParams.get('beta') ?? ''
  const personaLabel = PERSONA_LABELS[plan] ?? 'PIOS'

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  const onboardingNext = betaToken
    ? `/onboarding?beta=${encodeURIComponent(betaToken)}`
    : '/onboarding'

  function buildCallbackUrl() {
    if (typeof window === 'undefined') return '/auth/callback'

    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', onboardingNext)
    return callbackUrl.toString()
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    if (!supabase) {
      setError('PIOS is temporarily unavailable. Please refresh in a moment.')
      return
    }
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: buildCallbackUrl(),
        data: {
          plan,
          ...(betaToken ? { beta_token: betaToken } : {}),
        },
      },
    })

    setLoading(false)
    if (err) setError(err.message)
    else setSent(true)
  }

  async function handleGoogle() {
    if (!supabase) {
      setError('PIOS is temporarily unavailable. Please refresh in a moment.')
      return
    }
    setLoading(true)
    setError('')

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: buildGoogleOAuthOptions(window.location.origin, onboardingNext, 'auth'),
    })

    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className={styles.page}>
        <div className={styles.box}>
          <div className={styles.sentLogo}>PIOS</div>
          <div className={styles.sentIcon}>✉</div>
          <h2 className={styles.sentTitle}>Check your inbox.</h2>
          <p className={styles.sentSub}>
            A secure sign-in link has been sent to <strong>{email}</strong>.
            Click the link to open your command centre. It expires in 60 minutes.
          </p>
          <p className={styles.sentNote}>
            No email? Check your spam folder, or{' '}
            <button className={styles.resend} onClick={() => setSent(false)}>
              try a different address
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.backLink}>← Back to home</Link>
      <div className={styles.box}>
        <div className={styles.logo}>PIOS</div>
        <div className={styles.personaBadge}>{personaLabel}</div>
        {betaToken && <div className={styles.personaBadge}>Beta access</div>}

        <h2 className={styles.title}>Create your account</h2>
        <p className={styles.sub}>
          Enter your professional email. We'll send a secure link — no password
          created, no redirect to another service, no account to remember.
        </p>

        <form onSubmit={handleMagicLink} className={styles.form}>
          <label className={styles.fieldLabel}>Professional email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourcompany.com"
            required
            autoFocus
            className={styles.emailInput}
          />

          {error && <p className={styles.errorMsg}>{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !supabase}
            className={styles.sendBtn}
          >
            {loading ? 'Sending…' : 'Send secure link →'}
          </button>
        </form>

        <p className={styles.magicNote}>
          🔒 No password. A single-use link arrives in under 60 seconds.
        </p>

        <div className={styles.divider}><span>or</span></div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={!supabase}
          className={styles.googleBtn}
        >
          Continue with Google
        </button>

        <p className={styles.terms}>
          By continuing you agree to our{' '}
          <Link href="/terms">Terms of Service</Link> and{' '}
          <Link href="/privacy">Privacy Policy</Link>.
          VeritasIQ Technologies Ltd · info@veritasiq.io
        </p>

        <p className={styles.signinNote}>
          Already have an account?{' '}
          <Link href="/auth/login" className={styles.signinLink}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
