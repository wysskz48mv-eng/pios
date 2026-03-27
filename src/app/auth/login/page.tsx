'use client'
import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')
  const supabase = createClient()

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  return (
    <>
      <style>{`
        .auth-root {
          min-height: 100vh;
          background: var(--pios-bg);
          display: flex;
          font-family: var(--font-sans);
        }
        /* Brand panel — hidden on mobile, shown on desktop */
        .auth-brand {
          display: none;
        }
        /* Mobile logo header — shown on mobile, hidden on desktop */
        .auth-mobile-logo {
          display: block;
          text-align: center;
          margin-bottom: 36px;
        }
        @media (min-width: 900px) {
          .auth-brand {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            width: 42%;
            flex-shrink: 0;
            background: var(--pios-surface);
            border-right: 1px solid var(--pios-border);
            padding: 52px 48px;
            position: relative;
            overflow: hidden;
          }
          .auth-mobile-logo { display: none; }
        }
        .auth-glow-1 {
          position: absolute; top: -100px; left: -100px;
          width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(108,92,231,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .auth-glow-2 {
          position: absolute; bottom: -60px; right: -60px;
          width: 280px; height: 280px; border-radius: 50%;
          background: radial-gradient(circle, rgba(79,142,247,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .auth-form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
        }
        .auth-card {
          width: 100%;
          max-width: 400px;
          animation: fadeUp 0.25s ease-out;
        }
        .auth-inner {
          background: var(--pios-surface);
          border: 1px solid var(--pios-border2);
          border-radius: 18px;
          padding: 30px;
          position: relative;
          overflow: hidden;
        }
        .auth-inner::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, var(--ai), var(--academic));
          opacity: 0.5;
        }
        .auth-google-btn {
          width: 100%; display: flex; align-items: center; justify-content: center;
          gap: 10px; padding: 11px 16px; border-radius: 11px; cursor: pointer;
          background: var(--pios-surface2); border: 1px solid var(--pios-border2);
          color: var(--pios-text); font-size: 13px; font-weight: 600;
          font-family: var(--font-sans); margin-bottom: 20px; transition: all 0.15s;
        }
        .auth-google-btn:hover:not(:disabled) {
          background: var(--pios-surface3); border-color: var(--pios-border3);
        }
        .auth-submit-btn {
          width: 100%; display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 11px 16px; border-radius: 11px;
          color: #fff; border: none; cursor: pointer;
          font-size: 13px; font-weight: 700; font-family: var(--font-display);
          letter-spacing: -0.01em; transition: all 0.15s;
        }
        .auth-submit-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .auth-submit-btn:disabled { cursor: not-allowed; }
      `}</style>

      <div className="auth-root">

        {/* ── Left: brand panel (desktop only) ── */}
        <div className="auth-brand">
          <div className="auth-glow-1" />
          <div className="auth-glow-2" />

          {/* Wordmark */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(135deg, var(--ai) 0%, var(--academic) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: '#fff',
              }}>P</div>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17,
                color: 'var(--pios-text)', letterSpacing: '-0.02em',
              }}>PIOS</span>
            </div>

            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 33, fontWeight: 700,
              lineHeight: 1.18, letterSpacing: '-0.04em', color: 'var(--pios-text)',
              marginBottom: 16,
            }}>
              Your Intelligent<br />Operating System.
            </h2>
            <p style={{ fontSize: 14, color: 'var(--pios-muted)', lineHeight: 1.75, maxWidth: 290 }}>
              One platform for academic research, consulting frameworks,
              and executive operations — unified by AI.
            </p>
          </div>

          {/* Feature tiles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: '◉', color: 'var(--ai)',       title: 'NemoClaw™ AI',  sub: '15 proprietary consulting frameworks' },
              { icon: '◈', color: 'var(--academic)',  title: 'Academic Hub',  sub: 'DBA · PhD · CPD milestone engine' },
              { icon: '⚡', color: 'var(--pro)',      title: 'Executive OS',  sub: 'OKR · Decision Architecture · Board Pack' },
            ].map(f => (
              <div key={f.title} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: `${f.color}14`, border: `1px solid ${f.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color: f.color,
                }}>{f.icon}</div>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
                    color: 'var(--pios-text)', letterSpacing: '-0.01em',
                  }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 2 }}>{f.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            fontSize: 10.5, color: 'var(--pios-dim)',
            fontFamily: 'var(--font-mono)', lineHeight: 1.6,
          }}>
            © 2026 VeritasIQ Technologies Ltd<br />
            info@veritasiq.io
          </div>
        </div>

        {/* ── Right: form panel ── */}
        <div className="auth-form-panel">
          <div className="auth-card">

            {/* Mobile-only logo */}
            <div className="auth-mobile-logo">
              <div style={{
                width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
                background: 'linear-gradient(135deg, var(--ai), var(--academic))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#fff',
              }}>P</div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
                color: 'var(--pios-text)', letterSpacing: '-0.03em', marginBottom: 5,
              }}>Welcome back</div>
              <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
                Sign in to your PIOS workspace
              </div>
            </div>

            {/* Card */}
            <div className="auth-inner">

              {sent ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%', margin: '0 auto 18px',
                    background: 'var(--ai-subtle)', border: '1px solid rgba(108,92,231,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, color: 'var(--ai)',
                  }}>✉</div>
                  <h2 style={{
                    fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
                    letterSpacing: '-0.02em', marginBottom: 10, color: 'var(--pios-text)',
                  }}>Check your inbox</h2>
                  <p style={{ fontSize: 13, color: 'var(--pios-muted)', lineHeight: 1.65 }}>
                    Magic link sent to<br />
                    <strong style={{ color: 'var(--pios-text)' }}>{email}</strong>
                  </p>
                  <button onClick={() => { setSent(false); setEmail('') }} style={{
                    marginTop: 22, background: 'none', border: 'none',
                    color: 'var(--ai)', fontSize: 13, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}>← Use a different email</button>
                </div>
              ) : (
                <>
                  {/* Heading — desktop only (mobile shows the logo block above) */}
                  <div style={{ marginBottom: 22 }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
                      color: 'var(--pios-text)', letterSpacing: '-0.02em', marginBottom: 4,
                    }}>Sign in to PIOS</div>
                    <div style={{ fontSize: 12.5, color: 'var(--pios-muted)' }}>
                      Enter your email to receive a magic link
                    </div>
                  </div>

                  {/* Google */}
                  <button onClick={handleGoogle} disabled={loading} className="auth-google-btn">
                    <svg width="16" height="16" viewBox="0 0 18 18">
                      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                      <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
                      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
                    </svg>
                    Continue with Google
                  </button>

                  {/* Divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--pios-border)' }} />
                    <span style={{ color: 'var(--pios-dim)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em' }}>OR</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--pios-border)' }} />
                  </div>

                  {/* Magic link form */}
                  <form onSubmit={handleMagicLink}>
                    <label style={{
                      display: 'block', fontSize: 11, fontWeight: 600,
                      color: 'var(--pios-muted)', marginBottom: 7, letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}>Email address</label>
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com" required
                      className="pios-input"
                      style={{ marginBottom: error ? 8 : 14 }}
                    />
                    {error && (
                      <p style={{
                        color: 'var(--dng)', fontSize: 12, marginBottom: 12,
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}>⚠ {error}</p>
                    )}
                    <button
                      type="submit"
                      disabled={loading || !email}
                      className="auth-submit-btn"
                      style={{
                        background: loading || !email
                          ? 'rgba(108,92,231,0.35)'
                          : 'var(--ai)',
                      }}
                    >
                      {loading
                        ? <><span className="spin" style={{ display: 'inline-block', fontSize: 14 }}>⟳</span> Sending…</>
                        : 'Send magic link →'}
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12.5, color: 'var(--pios-muted)' }}>
                No account?{' '}
                <Link href="/auth/signup" style={{ color: 'var(--ai)', textDecoration: 'none', fontWeight: 600 }}>
                  Start free 14-day trial →
                </Link>
              </p>
              <p style={{ fontSize: 10.5, color: 'var(--pios-dim)', fontFamily: 'var(--font-mono)' }}>
                PIOS v3.0.2 · VeritasIQ Technologies Ltd
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
