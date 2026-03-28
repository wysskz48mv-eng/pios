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
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/auth/callback' },
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  async function googleSignIn() {
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/auth/callback',
          scopes: 'email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly',
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (error) setError(error.message)
    } catch (e: any) {
      setError(e.message ?? 'Google sign-in failed')
    }
    setLoading(false)
  }

  return (
    <main className="pios-login-wrap">
      <div className="pios-login-box">

        {/* Logo mark */}
        <div className="pios-login-logo">
          <span className="pios-login-p">P</span>
        </div>
        <h1 className="pios-login-h1">Welcome back.</h1>
        <p className="pios-login-sub">Sign in to your PIOS command centre</p>

        {/* Card */}
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
              <button
                className="pios-login-back"
                onClick={() => { setSent(false); setEmail('') }}
              >
                ← Different email
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                  fontSize: 12, color: '#f87171', lineHeight: 1.5,
                }}>
                  ⚠ {error}
                  {error.toLowerCase().includes('provider') || error.toLowerCase().includes('not enabled') ? (
                    <span style={{ display: 'block', marginTop: 4, color: 'rgba(255,255,255,0.4)' }}>
                      Use the email magic link below instead.
                    </span>
                  ) : null}
                </div>
              )}
              <button
                className="pios-login-google"
                onClick={googleSignIn}
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

              <div className="pios-login-or">
                <span className="pios-login-or-line" />
                <span className="pios-login-or-txt">OR</span>
                <span className="pios-login-or-line" />
              </div>

              <form onSubmit={sendMagicLink}>
                <label className="pios-login-label">Email address</label>
                <div className={`pios-login-field${error ? ' pios-login-field-err' : ''}`}>
                  <input
                    className="pios-login-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    required
                  />
                  <button
                    type="submit"
                    className="pios-login-send"
                    disabled={loading || !email}
                  >
                    {loading ? '…' : 'Send link →'}
                  </button>
                </div>
                {error && <p className="pios-login-err">{error}</p>}
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
