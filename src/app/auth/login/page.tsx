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
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
        scopes: 'email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--pios-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, margin: '0 auto 16px',
            background: 'rgba(99,73,255,0.12)', border: '1px solid rgba(99,73,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'rgba(130,108,255,0.9)' }}>P</span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26, fontWeight: 400, letterSpacing: '-0.025em',
            color: 'var(--pios-text)', marginBottom: 6,
          }}>Welcome back.</h1>
          <p style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
            Sign in to your PIOS command centre
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--pios-surface)',
          border: '1px solid var(--pios-border2)',
          borderRadius: 16,
          padding: '28px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* accent line */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
            background: 'linear-gradient(90deg, #6349FF, rgba(79,142,247,0.7) 60%, transparent)',
          }} />

          {sent ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                background: 'rgba(99,73,255,0.1)', border: '1px solid rgba(99,73,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>✉</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--pios-text)', marginBottom: 8 }}>
                Check your inbox.
              </h2>
              <p style={{ fontSize: 13, color: 'var(--pios-muted)', lineHeight: 1.7 }}>
                Magic link sent to<br />
                <strong style={{ color: 'var(--pios-text)' }}>{email}</strong>
              </p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                style={{ marginTop: 20, background: 'none', border: 'none', color: 'rgba(99,73,255,0.8)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ← Different email
              </button>
            </div>
          ) : (
            <>
              {/* Google */}
              <button
                onClick={googleSignIn}
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

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--pios-border)' }} />
                <span style={{ fontSize: 11, color: 'var(--pios-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>OR</span>
                <div style={{ flex: 1, height: 1, background: 'var(--pios-border)' }} />
              </div>

              {/* Magic link */}
              <form onSubmit={sendMagicLink}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--pios-dim)', marginBottom: 8,
                  fontFamily: 'var(--font-mono)',
                }}>
                  Email address
                </label>
                <div style={{
                  display: 'flex', borderRadius: 10, overflow: 'hidden',
                  border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'var(--pios-border2)'}`,
                  background: 'var(--pios-surface2)',
                }}>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@domain.com" required
                    style={{
                      flex: 1, padding: '11px 14px',
                      background: 'transparent', border: 'none', outline: 'none',
                      color: 'var(--pios-text)', fontSize: 14, fontFamily: 'inherit',
                    }}
                  />
                  <button
                    type="submit" disabled={loading || !email}
                    style={{
                      padding: '10px 18px',
                      background: loading || !email ? 'rgba(99,73,255,0.3)' : '#6349FF',
                      border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
                      fontFamily: 'inherit', cursor: loading || !email ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
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

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--pios-muted)' }}>
          No account?{' '}
          <Link href="/auth/signup" style={{ color: '#6349FF', textDecoration: 'none', fontWeight: 500 }}>
            Start free trial →
          </Link>
        </p>

      </div>
    </div>
  )
}
