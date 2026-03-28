'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const supabase = createClient()

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + '/auth/callback' },
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
              <p style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                Enter your email and we'll send you a secure sign-in link — no password needed.
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
