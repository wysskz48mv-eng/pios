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
      <div style={{
        display: 'none',
        width: '44%',
        background: 'linear-gradient(160deg, #0e1117 0%, #12102a 100%)',
        borderRight: '1px solid var(--pios-border)',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px',
        position: 'relative',
        overflow: 'hidden',
      }} className="login-panel">
        {/* Glow orb */}
        <div style={{
          position: 'absolute', top: -80, left: -80,
          width: 360, height: 360, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(155,135,245,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #9b87f5, #5b8def)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 15, color: '#fff',
              boxShadow: '0 4px 16px rgba(155,135,245,0.35)',
            }}>P</div>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em', color: 'var(--pios-text)' }}>PIOS</span>
          </div>

          <h2 style={{
            fontSize: 32, fontWeight: 800, lineHeight: 1.2,
            letterSpacing: '-0.04em', color: 'var(--pios-text)',
            marginBottom: 16,
          }}>
            Your Intelligent<br />Operating System.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--pios-muted)', lineHeight: 1.7, maxWidth: 320 }}>
            One platform for academic research, consulting frameworks, executive operations — and the AI that ties it all together.
          </p>
        </div>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            ['◉', 'NemoClaw AI', '15 proprietary consulting frameworks'],
            ['🎓', 'Academic Hub', 'DBA · PhD · CPD milestone engine'],
            ['⚡', 'Executive OS', 'OKR, Decision Architecture, Board Pack'],
          ].map(([icon, title, sub]) => (
            <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'rgba(155,135,245,0.08)', border: '1px solid rgba(155,135,245,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>{icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pios-text)' }}>{title}</div>
                <div style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 1 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'var(--pios-dim)' }}>
          © 2025 VeritasIQ Technologies Ltd · info@veritasiq.io
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }} className="fade-up">

          {/* Mobile logo (hidden on wide screens) */}
          <div style={{ textAlign: 'center', marginBottom: 40 }} className="login-logo-mobile">
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, #9b87f5, #5b8def)',
              fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 14,
              boxShadow: '0 4px 24px rgba(155,135,245,0.3)',
            }}>P</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--pios-text)', marginBottom: 4 }}>
              Welcome back
            </div>
            <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>
              Sign in to your PIOS workspace
            </div>
          </div>

          <div style={{
            background: 'var(--pios-surface)',
            border: '1px solid var(--pios-border2)',
            borderRadius: 16, padding: '28px 28px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                  background: 'rgba(155,135,245,0.1)', border: '1px solid rgba(155,135,245,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>✉</div>
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>
                  Check your inbox
                </h2>
                <p style={{ color: 'var(--pios-muted)', fontSize: 13, lineHeight: 1.6 }}>
                  Magic link sent to<br />
                  <strong style={{ color: 'var(--pios-text)' }}>{email}</strong>
                </p>
                <button
                  onClick={() => { setSent(false); setEmail('') }}
                  style={{
                    marginTop: 20, background: 'none', border: 'none',
                    color: 'var(--ai)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}>
                  ← Use a different email
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 10, padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
                    background: 'var(--pios-surface2)', border: '1px solid var(--pios-border2)',
                    color: 'var(--pios-text)', fontSize: 13, fontWeight: 600,
                    fontFamily: 'var(--font-sans)', marginBottom: 18, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--pios-border3)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--pios-surface3)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--pios-border2)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--pios-surface2)' }}
                >
                  <svg width="17" height="17" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                    <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
                  </svg>
                  Continue with Google
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--pios-border)' }} />
                  <span style={{ color: 'var(--pios-dim)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em' }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--pios-border)' }} />
                </div>

                <form onSubmit={handleMagicLink}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--pios-muted)', marginBottom: 6, letterSpacing: '0.02em' }}>
                    Email address
                  </label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required className="pios-input"
                    style={{ marginBottom: error ? 8 : 14 }}
                  />
                  {error && (
                    <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>⚠</span> {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading || !email}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 8, padding: '11px 16px', borderRadius: 10,
                      background: loading || !email ? 'rgba(155,135,245,0.4)' : 'var(--ai)',
                      color: '#08090c', border: 'none', cursor: loading || !email ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
                    }}
                  >
                    {loading ? (
                      <><span className="spin" style={{ display: 'inline-block', fontSize: 14 }}>⟳</span> Sending…</>
                    ) : (
                      <>Send magic link →</>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 12, color: 'var(--pios-dim)' }}>
              No account?{' '}
              <Link href="/auth/signup" style={{ color: 'var(--ai)', textDecoration: 'none', fontWeight: 600 }}>
                Start free 14-day trial →
              </Link>
            </p>
            <p style={{ fontSize: 11, color: 'var(--pios-dim)' }}>
              PIOS v3.0 · VeritasIQ Technologies Ltd
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .login-panel { display: flex !important; }
          .login-logo-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
