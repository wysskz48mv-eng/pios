'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Login v3.0 — Investment-Grade UIX
// Split panel: brand left · form right · Syne display font
// All auth logic preserved — only presentation upgraded
// ─────────────────────────────────────────────────────────────────────────────

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
    <div style={{
      minHeight: '100vh', background: 'var(--pios-bg)',
      display: 'flex', fontFamily: 'var(--font-sans)',
    }}>

      {/* ── Left panel — brand ── */}
      <div className="auth-brand-panel" style={{
        display: 'none',
        width: '42%',
        background: 'linear-gradient(160deg, var(--pios-surface) 0%, #0d0b20 100%)',
        borderRight: '1px solid var(--pios-border)',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '52px 48px',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Ambient glow orbs */}
        <div style={{
          position: 'absolute', top: -100, left: -100,
          width: 420, height: 420, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(139,124,248,0.1) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, right: -60,
          width: 280, height: 280, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(79,142,247,0.08) 0%, transparent 70%)',
        }} />

        {/* Top: wordmark */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 72 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--ai) 0%, var(--academic) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: '#fff',
              boxShadow: '0 0 24px rgba(139,124,248,0.35)',
            }}>P</div>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
              color: 'var(--pios-text)', letterSpacing: '-0.02em',
            }}>PIOS</span>
          </div>

          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700,
            lineHeight: 1.15, letterSpacing: '-0.04em', color: 'var(--pios-text)',
            marginBottom: 18,
          }}>
            Your Intelligent<br />Operating System.
          </h2>
          <p style={{ fontSize: 14, color: 'var(--pios-muted)', lineHeight: 1.75, maxWidth: 300 }}>
            One platform for academic research, consulting frameworks,
            and executive operations — unified by AI.
          </p>
        </div>

        {/* Feature tiles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: '◉', color: 'var(--ai)',      title: 'NemoClaw™ AI',  sub: '15 proprietary consulting frameworks' },
            { icon: '◈', color: 'var(--academic)', title: 'Academic Hub', sub: 'DBA · PhD · CPD milestone engine' },
            { icon: '⚡', color: 'var(--pro)',     title: 'Executive OS', sub: 'OKR · Decision Architecture · Board Pack' },
          ].map(f => (
            <div key={f.title} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: `${f.color}12`, border: `1px solid ${f.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, color: f.color,
              }}>{f.icon}</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--pios-text)', letterSpacing: '-0.01em' }}>{f.title}</div>
                <div style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 1 }}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ fontSize: 10.5, color: 'var(--pios-dim)', fontFamily: 'var(--font-mono)' }}>
          © 2025 VeritasIQ Technologies Ltd · info@veritasiq.io
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }} className="fade-up">

          {/* Mobile-only logo */}
          <div className="auth-mobile-header" style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
              background: 'linear-gradient(135deg, var(--ai), var(--academic))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#fff',
              boxShadow: '0 4px 28px rgba(139,124,248,0.3)',
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
          <div style={{
            background: 'var(--pios-surface)',
            border: '1px solid var(--pios-border2)',
            borderRadius: 18, padding: '30px',
            boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Subtle top gradient rule */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 1,
              background: 'linear-gradient(90deg, var(--ai), var(--academic))',
              opacity: 0.5,
            }} />

            {sent ? (
              /* ── Sent state ── */
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%', margin: '0 auto 18px',
                  background: 'var(--ai-subtle)', border: '1px solid rgba(139,124,248,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, color: 'var(--ai)',
                }}>✉</div>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
                  letterSpacing: '-0.02em', marginBottom: 10,
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
                {/* ── Desktop heading ── */}
                <div className="auth-form-header" style={{ marginBottom: 24 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700,
                    color: 'var(--pios-text)', letterSpacing: '-0.02em', marginBottom: 4,
                  }}>Sign in</div>
                  <div style={{ fontSize: 12.5, color: 'var(--pios-muted)' }}>
                    to your PIOS workspace
                  </div>
                </div>

                {/* Google */}
                <button onClick={handleGoogle} disabled={loading} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 10, padding: '11px 16px', borderRadius: 11, cursor: 'pointer',
                  background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
                  color: 'var(--pios-text)', fontSize: 13, fontWeight: 600,
                  fontFamily: 'var(--font-sans)', marginBottom: 20, transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--pios-border3)'; b.style.background = 'var(--pios-surface3)' }}
                  onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--pios-border2)'; b.style.background = 'var(--pios-surface2)' }}>
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
                    color: 'var(--pios-muted)', marginBottom: 7, letterSpacing: '0.04em',
                  }}>EMAIL ADDRESS</label>
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
                  <button type="submit" disabled={loading || !email} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '11px 16px', borderRadius: 11,
                    background: loading || !email ? 'rgba(139,124,248,0.35)' : 'var(--ai)',
                    color: 'var(--pios-bg)', border: 'none',
                    cursor: loading || !email ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)',
                    letterSpacing: '-0.01em', transition: 'all 0.15s',
                  }}>
                    {loading
                      ? <><span className="spin" style={{ display: 'inline-block', fontSize: 14 }}>⟳</span> Sending…</>
                      : 'Send magic link →'}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Footer links */}
          <div style={{ textAlign: 'center', marginTop: 22, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <p style={{ fontSize: 12.5, color: 'var(--pios-muted)' }}>
              No account?{' '}
              <Link href="/auth/signup" style={{ color: 'var(--ai)', textDecoration: 'none', fontWeight: 600 }}>
                Start free 14-day trial →
              </Link>
            </p>
            <p style={{ fontSize: 10.5, color: 'var(--pios-dim)', fontFamily: 'var(--font-mono)' }}>
              PIOS v3.0 · VeritasIQ Technologies Ltd
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 860px) {
          .auth-brand-panel  { display: flex !important; }
          .auth-mobile-header { display: none !important; }
        }
      `}</style>
    </div>
  )
}
