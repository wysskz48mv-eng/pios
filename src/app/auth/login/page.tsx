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
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }
        @keyframes shimmer { 0%,100% { opacity:.35 } 50% { opacity:.65 } }
        @keyframes spin { to { transform:rotate(360deg) } }

        .auth-root {
          min-height: 100vh;
          background: var(--pios-bg);
          display: flex;
          font-family: var(--font-sans);
        }

        /* ── Brand panel ── */
        .auth-brand {
          display: none;
        }
        @media (min-width: 900px) {
          .auth-brand {
            display: flex;
            flex-direction: column;
            width: 44%;
            flex-shrink: 0;
            background: var(--pios-surface);
            border-right: 1px solid var(--pios-border);
            padding: 56px 52px;
            position: relative;
            overflow: hidden;
          }
        }

        /* Noise texture overlay on brand panel */
        .auth-brand::after {
          content:'';
          position:absolute; inset:0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events:none; opacity:.5;
        }

        /* Ambient glow blobs */
        .auth-glow-1 {
          position:absolute; top:-80px; left:-80px;
          width:360px; height:360px; border-radius:50%;
          background: radial-gradient(circle, rgba(108,92,231,0.15) 0%, transparent 70%);
          pointer-events:none; animation: shimmer 6s ease-in-out infinite;
        }
        .auth-glow-2 {
          position:absolute; bottom:-40px; right:-60px;
          width:240px; height:240px; border-radius:50%;
          background: radial-gradient(circle, rgba(79,142,247,0.1) 0%, transparent 70%);
          pointer-events:none; animation: shimmer 8s ease-in-out infinite 2s;
        }
        .auth-glow-3 {
          position:absolute; top:50%; left:50%;
          transform:translate(-50%,-50%);
          width:500px; height:2px;
          background: linear-gradient(90deg, transparent, rgba(108,92,231,0.12), transparent);
          pointer-events:none;
        }

        /* ── Form panel ── */
        .auth-form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          background: var(--pios-bg);
        }
        .auth-card {
          width: 100%;
          max-width: 396px;
          animation: fadeUp 0.3s cubic-bezier(0.16,1,0.3,1);
        }

        /* Mobile logo */
        .auth-mobile-logo { display: flex; flex-direction: column; align-items: center; margin-bottom: 32px; }
        @media (min-width: 900px) { .auth-mobile-logo { display: none; } }

        /* Form card */
        .auth-inner {
          background: var(--pios-surface);
          border: 1px solid var(--pios-border2);
          border-radius: 20px;
          padding: 32px 30px;
          position: relative;
          overflow: hidden;
        }
        /* Top accent line — two colours */
        .auth-inner::before {
          content:'';
          position:absolute; top:0; left:0; right:0; height:1.5px;
          background: linear-gradient(90deg, var(--ai) 0%, var(--academic) 60%, transparent 100%);
        }

        /* Google button */
        .auth-google-btn {
          width:100%; display:flex; align-items:center; justify-content:center;
          gap:10px; padding:11px 16px; border-radius:12px; cursor:pointer;
          background: var(--pios-surface2); border: 1px solid var(--pios-border2);
          color: var(--pios-text); font-size:13px; font-weight:600;
          font-family: var(--font-sans); transition: all 0.15s ease;
        }
        .auth-google-btn:hover:not(:disabled) {
          background: var(--pios-surface3); border-color: var(--pios-border3);
          transform: translateY(-1px);
        }
        .auth-google-btn:active { transform: none; }
        .auth-google-btn:disabled { opacity:.5; cursor:not-allowed; }

        /* Submit button */
        .auth-submit-btn {
          width:100%; display:flex; align-items:center; justify-content:center;
          gap:8px; padding:12px 16px; border-radius:12px; border:none; cursor:pointer;
          background: var(--ai); color:#fff;
          font-size:13.5px; font-weight:700; font-family: var(--font-display);
          letter-spacing:-0.01em; transition: all 0.15s ease;
        }
        .auth-submit-btn:hover:not(:disabled) {
          opacity:.92; transform:translateY(-1px);
          box-shadow: 0 4px 16px rgba(108,92,231,0.35);
        }
        .auth-submit-btn:active { transform: none; box-shadow: none; }
        .auth-submit-btn:disabled { background: rgba(108,92,231,0.35); cursor:not-allowed; }

        /* Email input override for auth */
        .auth-input {
          width:100%; padding:11px 14px; border-radius:11px;
          background: var(--pios-surface2); border: 1px solid var(--pios-border2);
          color: var(--pios-text); font-size:13.5px; font-family: var(--font-sans);
          outline: none; transition: border-color 0.15s, box-shadow 0.15s;
          margin-bottom: 14px;
        }
        .auth-input:focus {
          border-color: rgba(108,92,231,0.5);
          box-shadow: 0 0 0 3px rgba(108,92,231,0.08);
        }
        .auth-input::placeholder { color: var(--pios-dim); }

        /* Feature tile */
        .feat-tile {
          display:flex; align-items:center; gap:14px;
          padding:14px 16px; border-radius:14px;
          background: rgba(255,255,255,0.025);
          border: 1px solid var(--pios-border);
          transition: border-color 0.2s;
        }
        .feat-tile:hover { border-color: var(--pios-border2); }

        /* Spinning loader */
        .spin-loader { animation: spin 0.8s linear infinite; display:inline-block; }
      `}</style>

      <div className="auth-root">

        {/* ── Left: brand panel ── */}
        <div className="auth-brand">
          <div className="auth-glow-1" />
          <div className="auth-glow-2" />
          <div className="auth-glow-3" />

          {/* Logo + wordmark */}
          <div style={{ position:'relative', zIndex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:60 }}>
              {/* Hex logo mark */}
              <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                <polygon points="19,2 35,11 35,27 19,36 3,27 3,11"
                  fill="rgba(108,92,231,0.12)" stroke="rgba(108,92,231,0.6)" strokeWidth="1.2"/>
                <polygon points="19,8 30,14.5 30,23.5 19,30 8,23.5 8,14.5"
                  fill="none" stroke="rgba(108,92,231,0.25)" strokeWidth="0.6"/>
                <text x="19" y="23" textAnchor="middle"
                  fontFamily="var(--font-display)" fontWeight="800" fontSize="13" fill="rgba(108,92,231,0.9)">P</text>
              </svg>
              <div>
                <div style={{
                  fontFamily:'var(--font-display)', fontWeight:800, fontSize:18,
                  color:'var(--pios-text)', letterSpacing:'-0.03em', lineHeight:1,
                }}>PIOS</div>
                <div style={{
                  fontFamily:'var(--font-mono)', fontSize:8.5, color:'var(--pios-dim)',
                  letterSpacing:'1.4px', textTransform:'uppercase', marginTop:2,
                }}>v3.0 · VeritasIQ</div>
              </div>
            </div>

            {/* Headline */}
            <h1 style={{
              fontFamily:'var(--font-display)', fontSize:38, fontWeight:700,
              lineHeight:1.1, letterSpacing:'-0.04em', color:'var(--pios-text)',
              marginBottom:18,
            }}>
              Your Intelligent<br />
              <span style={{ color:'var(--ai)' }}>Operating</span> System.
            </h1>
            <p style={{ fontSize:14, color:'var(--pios-muted)', lineHeight:1.8, maxWidth:300, marginBottom:52 }}>
              One platform for academic research, consulting frameworks,
              and executive operations — unified by AI.
            </p>

            {/* Feature tiles */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                {
                  gradient: 'linear-gradient(135deg, rgba(108,92,231,0.2), rgba(108,92,231,0.05))',
                  border: 'rgba(108,92,231,0.25)',
                  dot: 'var(--ai)',
                  title: 'NemoClaw™ AI',
                  sub: '15 proprietary consulting frameworks',
                  badge: 'AI',
                },
                {
                  gradient: 'linear-gradient(135deg, rgba(79,142,247,0.15), rgba(79,142,247,0.03))',
                  border: 'rgba(79,142,247,0.2)',
                  dot: 'var(--academic)',
                  title: 'Academic Hub',
                  sub: 'DBA · PhD · CPD milestone engine',
                  badge: 'RESEARCH',
                },
                {
                  gradient: 'linear-gradient(135deg, rgba(56,217,245,0.12), rgba(56,217,245,0.02))',
                  border: 'rgba(56,217,245,0.18)',
                  dot: 'var(--pro)',
                  title: 'Executive OS',
                  sub: 'OKR · Decision Architecture · Board Pack',
                  badge: 'EXEC',
                },
              ].map(f => (
                <div key={f.title} style={{
                  display:'flex', alignItems:'center', gap:14, padding:'13px 16px',
                  borderRadius:13, background:f.gradient, border:`1px solid ${f.border}`,
                }}>
                  <div style={{
                    width:8, height:8, borderRadius:'50%', background:f.dot,
                    flexShrink:0, boxShadow:`0 0 8px ${f.dot}60`,
                  }} />
                  <div style={{ flex:1 }}>
                    <div style={{
                      fontFamily:'var(--font-display)', fontSize:13, fontWeight:700,
                      color:'var(--pios-text)', letterSpacing:'-0.01em',
                    }}>{f.title}</div>
                    <div style={{ fontSize:11, color:'var(--pios-muted)', marginTop:2 }}>{f.sub}</div>
                  </div>
                  <span style={{
                    fontFamily:'var(--font-mono)', fontSize:8, fontWeight:700,
                    color:f.dot, border:`1px solid ${f.border}`,
                    padding:'2px 7px', borderRadius:4, letterSpacing:'0.08em',
                  }}>{f.badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Brand footer */}
          <div style={{
            position:'relative', zIndex:1, marginTop:'auto', paddingTop:40,
            borderTop:'1px solid var(--pios-border)',
          }}>
            <div style={{
              fontFamily:'var(--font-mono)', fontSize:10, color:'var(--pios-dim)',
              lineHeight:1.7,
            }}>
              © 2026 VeritasIQ Technologies Ltd<br />
              <a href="mailto:info@veritasiq.io" style={{ color:'var(--pios-dim)', textDecoration:'none' }}>
                info@veritasiq.io
              </a>
            </div>
          </div>
        </div>

        {/* ── Right: form panel ── */}
        <div className="auth-form-panel">
          <div className="auth-card">

            {/* Mobile-only logo */}
            <div className="auth-mobile-logo">
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style={{ marginBottom:14 }}>
                <polygon points="26,3 48,15.5 48,36.5 26,49 4,36.5 4,15.5"
                  fill="rgba(108,92,231,0.15)" stroke="rgba(108,92,231,0.5)" strokeWidth="1.5"/>
                <polygon points="26,10 41,18.5 41,33.5 26,42 11,33.5 11,18.5"
                  fill="none" stroke="rgba(108,92,231,0.2)" strokeWidth="0.8"/>
                <text x="26" y="32" textAnchor="middle"
                  fontFamily="var(--font-display)" fontWeight="800" fontSize="18" fill="rgba(108,92,231,0.9)">P</text>
              </svg>
              <div style={{
                fontFamily:'var(--font-display)', fontSize:22, fontWeight:700,
                color:'var(--pios-text)', letterSpacing:'-0.03em', marginBottom:5,
              }}>Welcome back</div>
              <div style={{ fontSize:13, color:'var(--pios-muted)' }}>
                Sign in to your PIOS workspace
              </div>
            </div>

            {/* Card */}
            <div className="auth-inner">

              {sent ? (
                /* ── Sent state ── */
                <div style={{ textAlign:'center', padding:'12px 0 8px' }}>
                  <div style={{
                    width:64, height:64, borderRadius:'50%', margin:'0 auto 20px',
                    background:'var(--ai-subtle)', border:'1px solid rgba(108,92,231,0.25)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ai)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <h2 style={{
                    fontFamily:'var(--font-display)', fontSize:19, fontWeight:700,
                    letterSpacing:'-0.025em', marginBottom:10, color:'var(--pios-text)',
                  }}>Check your inbox</h2>
                  <p style={{ fontSize:13, color:'var(--pios-muted)', lineHeight:1.7 }}>
                    Magic link sent to<br />
                    <strong style={{ color:'var(--pios-text)', fontWeight:600 }}>{email}</strong>
                  </p>
                  <button onClick={() => { setSent(false); setEmail('') }} style={{
                    marginTop:24, background:'none', border:'none',
                    color:'var(--ai)', fontSize:13, cursor:'pointer',
                    fontFamily:'var(--font-sans)', opacity:.8,
                  }}>← Use a different email</button>
                </div>

              ) : (
                <>
                  {/* Heading */}
                  <div style={{ marginBottom:24 }}>
                    <div style={{
                      fontFamily:'var(--font-display)', fontSize:19, fontWeight:700,
                      color:'var(--pios-text)', letterSpacing:'-0.025em', marginBottom:5,
                    }}>Sign in to PIOS</div>
                    <div style={{ fontSize:12.5, color:'var(--pios-muted)', lineHeight:1.5 }}>
                      Enter your email to receive a magic link
                    </div>
                  </div>

                  {/* Google button */}
                  <button onClick={handleGoogle} disabled={loading} className="auth-google-btn"
                    style={{ marginBottom:20 }}>
                    <svg width="16" height="16" viewBox="0 0 18 18">
                      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                      <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
                      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
                    </svg>
                    Continue with Google
                  </button>

                  {/* OR divider */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                    <div style={{ flex:1, height:1, background:'var(--pios-border)' }} />
                    <span style={{
                      color:'var(--pios-dim)', fontSize:10, fontWeight:700,
                      letterSpacing:'0.1em', fontFamily:'var(--font-mono)',
                    }}>OR</span>
                    <div style={{ flex:1, height:1, background:'var(--pios-border)' }} />
                  </div>

                  {/* Magic link form */}
                  <form onSubmit={handleMagicLink}>
                    <label style={{
                      display:'block', fontSize:10.5, fontWeight:700,
                      color:'var(--pios-muted)', marginBottom:7,
                      letterSpacing:'0.08em', textTransform:'uppercase',
                      fontFamily:'var(--font-mono)',
                    }}>Email address</label>
                    <input
                      type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com" required
                      className="auth-input"
                      style={{ marginBottom: error ? 8 : 14 }}
                    />
                    {error && (
                      <p style={{
                        color:'#f87171', fontSize:12, marginBottom:12,
                        display:'flex', alignItems:'center', gap:6,
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        {error}
                      </p>
                    )}
                    <button type="submit" disabled={loading || !email} className="auth-submit-btn">
                      {loading
                        ? <><span className="spin-loader">⟳</span> Sending…</>
                        : 'Send magic link →'}
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Footer links */}
            <div style={{ textAlign:'center', marginTop:22, display:'flex', flexDirection:'column', gap:8 }}>
              <p style={{ fontSize:12.5, color:'var(--pios-muted)' }}>
                No account?{' '}
                <Link href="/auth/signup" style={{ color:'var(--ai)', textDecoration:'none', fontWeight:600 }}>
                  Start free 14-day trial →
                </Link>
              </p>
              <p style={{
                fontSize:10, color:'var(--pios-dim)',
                fontFamily:'var(--font-mono)', letterSpacing:'0.04em',
              }}>
                PIOS v3.0.2 · VeritasIQ Technologies Ltd
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
