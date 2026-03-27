'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [error,    setError]    = useState('')
  const [wide,     setWide]     = useState(false)
  const supabase = createClient()

  // Detect desktop breakpoint client-side
  useEffect(() => {
    const check = () => setWide(window.innerWidth >= 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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

  // Design tokens (match globals.css exactly)
  const T = {
    bg:       '#0e0f1a',
    surface:  '#13152a',
    surface2: '#1a1d35',
    surface3: '#21254a',
    border:   'rgba(255,255,255,0.07)',
    border2:  'rgba(255,255,255,0.10)',
    border3:  'rgba(255,255,255,0.16)',
    text:     '#f8f9ff',
    sub:      '#c4c8e8',
    muted:    '#8890bb',
    dim:      '#4a5080',
    ai:       '#6c5ce7',
    academic: '#4f8ef7',
    pro:      '#38d9f5',
  }

  // Hex logo SVG component
  const HexLogo = ({ size = 38 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none">
      <polygon points="19,2 35,11 35,27 19,36 3,27 3,11"
        fill="rgba(108,92,231,0.15)" stroke="rgba(108,92,231,0.55)" strokeWidth="1.2"/>
      <polygon points="19,8 30,14.5 30,23.5 19,30 8,23.5 8,14.5"
        fill="none" stroke="rgba(108,92,231,0.22)" strokeWidth="0.7"/>
      <text x="19" y="23.5" textAnchor="middle"
        style={{ fontFamily:'Georgia,serif', fontWeight:900, fontSize:13, fill:'rgba(140,120,255,0.95)' }}>P</text>
    </svg>
  )

  const FEATURES = [
    { color: T.ai,       bg: 'rgba(108,92,231,0.1)',  border: 'rgba(108,92,231,0.2)',  title: 'NemoClaw™ AI',  sub: '15 proprietary consulting frameworks',    badge: 'AI' },
    { color: T.academic, bg: 'rgba(79,142,247,0.1)',   border: 'rgba(79,142,247,0.18)',  title: 'Academic Hub',  sub: 'DBA · PhD · CPD milestone engine',        badge: 'RESEARCH' },
    { color: T.pro,      bg: 'rgba(56,217,245,0.08)',  border: 'rgba(56,217,245,0.15)',  title: 'Executive OS',  sub: 'OKR · Decision Architecture · Board Pack', badge: 'EXEC' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      display: 'flex',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>

      {/* ── LEFT: Brand panel (desktop only) ── */}
      {wide && (
        <div style={{
          width: '44%', flexShrink: 0,
          background: T.surface,
          borderRight: `1px solid ${T.border2}`,
          padding: '52px 48px',
          display: 'flex', flexDirection: 'column',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Ambient glows */}
          <div style={{
            position:'absolute', top:-80, left:-80, width:360, height:360,
            borderRadius:'50%',
            background:'radial-gradient(circle, rgba(108,92,231,0.13) 0%, transparent 70%)',
            pointerEvents:'none',
          }} />
          <div style={{
            position:'absolute', bottom:-40, right:-60, width:240, height:240,
            borderRadius:'50%',
            background:'radial-gradient(circle, rgba(79,142,247,0.09) 0%, transparent 70%)',
            pointerEvents:'none',
          }} />

          {/* Content */}
          <div style={{ position:'relative', zIndex:1, flex:1, display:'flex', flexDirection:'column' }}>
            {/* Wordmark */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:56 }}>
              <HexLogo size={38} />
              <div>
                <div style={{
                  fontFamily:"Georgia,'Times New Roman',serif",
                  fontWeight:900, fontSize:18,
                  color: T.text, letterSpacing:'-0.02em', lineHeight:1,
                }}>PIOS</div>
                <div style={{
                  fontFamily:"'SF Mono','Courier New',monospace",
                  fontSize:8.5, color: T.dim,
                  letterSpacing:'1.3px', textTransform:'uppercase', marginTop:3,
                }}>v3.0 · VeritasIQ</div>
              </div>
            </div>

            {/* Headline */}
            <h1 style={{
              fontFamily:"Georgia,'Times New Roman',serif",
              fontSize: 38, fontWeight:700,
              lineHeight:1.1, letterSpacing:'-0.035em',
              color: T.text, marginBottom:16,
            }}>
              Your Intelligent<br />
              <span style={{ color: T.ai }}>Operating</span> System.
            </h1>
            <p style={{
              fontSize:14, color: T.muted,
              lineHeight:1.8, maxWidth:290, marginBottom:48,
            }}>
              One platform for academic research, consulting frameworks,
              and executive operations — unified by AI.
            </p>

            {/* Feature tiles */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {FEATURES.map(f => (
                <div key={f.title} style={{
                  display:'flex', alignItems:'center', gap:14,
                  padding:'13px 16px', borderRadius:13,
                  background: f.bg, border:`1px solid ${f.border}`,
                }}>
                  <div style={{
                    width:8, height:8, borderRadius:'50%',
                    background: f.color, flexShrink:0,
                    boxShadow:`0 0 8px ${f.color}60`,
                  }} />
                  <div style={{ flex:1 }}>
                    <div style={{
                      fontFamily:"Georgia,serif", fontSize:13, fontWeight:700,
                      color: T.text, letterSpacing:'-0.01em',
                    }}>{f.title}</div>
                    <div style={{ fontSize:11, color: T.muted, marginTop:2 }}>{f.sub}</div>
                  </div>
                  <span style={{
                    fontFamily:"'SF Mono','Courier New',monospace",
                    fontSize:8, fontWeight:700, color: f.color,
                    border:`1px solid ${f.border}`,
                    padding:'2px 7px', borderRadius:4,
                    letterSpacing:'0.08em',
                  }}>{f.badge}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              marginTop:'auto', paddingTop:40,
              borderTop:`1px solid ${T.border}`,
            }}>
              <div style={{
                fontFamily:"'SF Mono','Courier New',monospace",
                fontSize:10, color: T.dim, lineHeight:1.7,
              }}>
                © 2026 VeritasIQ Technologies Ltd<br />
                <a href="mailto:info@veritasiq.io"
                  style={{ color: T.dim, textDecoration:'none' }}>
                  info@veritasiq.io
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RIGHT: Form panel ── */}
      <div style={{
        flex:1, display:'flex', alignItems:'center', justifyContent:'center',
        padding: '40px 24px',
        background: T.bg,
        minHeight: '100vh',
      }}>
        <div style={{
          width:'100%', maxWidth:400,
          animation:'fadeUp 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>

          {/* Mobile-only logo block */}
          {!wide && (
            <div style={{
              display:'flex', flexDirection:'column',
              alignItems:'center', marginBottom:36, textAlign:'center',
            }}>
              <HexLogo size={54} />
              <div style={{
                fontFamily:"Georgia,serif", fontSize:24, fontWeight:700,
                color: T.text, letterSpacing:'-0.03em', marginTop:14, marginBottom:5,
              }}>Welcome back</div>
              <div style={{ fontSize:13, color: T.muted }}>
                Sign in to your PIOS workspace
              </div>
            </div>
          )}

          {/* Form card */}
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border2}`,
            borderRadius:20, padding:'30px 28px',
            position:'relative', overflow:'hidden',
          }}>
            {/* Top accent bar */}
            <div style={{
              position:'absolute', top:0, left:0, right:0, height:1.5,
              background:`linear-gradient(90deg, ${T.ai}, ${T.academic} 65%, transparent)`,
            }} />

            {sent ? (
              /* ── Sent state ── */
              <div style={{ textAlign:'center', padding:'16px 0 8px' }}>
                <div style={{
                  width:64, height:64, borderRadius:'50%',
                  margin:'0 auto 20px',
                  background:'rgba(108,92,231,0.1)',
                  border:'1px solid rgba(108,92,231,0.25)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                    stroke={T.ai} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <h2 style={{
                  fontFamily:"Georgia,serif", fontSize:19, fontWeight:700,
                  letterSpacing:'-0.02em', marginBottom:10, color: T.text,
                }}>Check your inbox</h2>
                <p style={{ fontSize:13, color: T.muted, lineHeight:1.7 }}>
                  Magic link sent to<br />
                  <strong style={{ color: T.text, fontWeight:600 }}>{email}</strong>
                </p>
                <button onClick={() => { setSent(false); setEmail('') }} style={{
                  marginTop:24, background:'none', border:'none',
                  color: T.ai, fontSize:13, cursor:'pointer',
                  fontFamily:'inherit', opacity:.8,
                }}>← Use a different email</button>
              </div>

            ) : (
              <>
                {/* Desktop heading */}
                {wide && (
                  <div style={{ marginBottom:22 }}>
                    <div style={{
                      fontFamily:"Georgia,serif", fontSize:19, fontWeight:700,
                      color: T.text, letterSpacing:'-0.02em', marginBottom:5,
                    }}>Sign in to PIOS</div>
                    <div style={{ fontSize:12.5, color: T.muted }}>
                      Enter your email to receive a magic link
                    </div>
                  </div>
                )}

                {/* Google button */}
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  style={{
                    width:'100%', display:'flex', alignItems:'center',
                    justifyContent:'center', gap:10,
                    padding:'11px 16px', borderRadius:12, cursor:'pointer',
                    background: T.surface2, border:`1px solid ${T.border2}`,
                    color: T.text, fontSize:13, fontWeight:600,
                    fontFamily:'inherit', marginBottom:18,
                    transition:'all 0.15s',
                    opacity: loading ? 0.5 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!loading) {
                      (e.currentTarget as HTMLButtonElement).style.background = T.surface3
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = T.border3
                    }
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = T.surface2
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = T.border2
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                    <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
                  </svg>
                  Continue with Google
                </button>

                {/* OR divider */}
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
                  <div style={{ flex:1, height:1, background: T.border }} />
                  <span style={{
                    color: T.dim, fontSize:10, fontWeight:700,
                    letterSpacing:'0.1em',
                    fontFamily:"'SF Mono','Courier New',monospace",
                  }}>OR</span>
                  <div style={{ flex:1, height:1, background: T.border }} />
                </div>

                {/* Magic link form */}
                <form onSubmit={handleMagicLink}>
                  <label style={{
                    display:'block', fontSize:10.5, fontWeight:700,
                    color: T.muted, marginBottom:7,
                    letterSpacing:'0.08em', textTransform:'uppercase' as const,
                    fontFamily:"'SF Mono','Courier New',monospace",
                  }}>Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={{
                      display:'block', width:'100%',
                      padding:'11px 14px', borderRadius:11,
                      background: T.surface2,
                      border:`1px solid ${error ? 'rgba(239,68,68,0.4)' : T.border2}`,
                      color: T.text, fontSize:13.5,
                      fontFamily:'inherit', outline:'none',
                      marginBottom: error ? 8 : 14,
                      boxSizing:'border-box' as const,
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'rgba(108,92,231,0.55)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(108,92,231,0.09)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = error ? 'rgba(239,68,68,0.4)' : T.border2
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />

                  {error && (
                    <p style={{
                      color:'#f87171', fontSize:12, marginBottom:12,
                      display:'flex', alignItems:'center', gap:6,
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email}
                    style={{
                      width:'100%', display:'flex', alignItems:'center',
                      justifyContent:'center', gap:8,
                      padding:'12px 16px', borderRadius:12, border:'none',
                      background: loading || !email ? 'rgba(108,92,231,0.35)' : T.ai,
                      color:'#fff', fontSize:13.5, fontWeight:700,
                      fontFamily:"Georgia,serif",
                      letterSpacing:'-0.01em', cursor: loading || !email ? 'not-allowed' : 'pointer',
                      transition:'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (!loading && email) {
                        ;(e.currentTarget as HTMLButtonElement).style.opacity = '0.88'
                        ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(108,92,231,0.35)'
                      }
                    }}
                    onMouseLeave={e => {
                      ;(e.currentTarget as HTMLButtonElement).style.opacity = '1'
                      ;(e.currentTarget as HTMLButtonElement).style.transform = 'none'
                      ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
                    }}
                  >
                    {loading ? 'Sending…' : 'Send magic link →'}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{
            textAlign:'center', marginTop:22,
            display:'flex', flexDirection:'column', gap:8,
          }}>
            <p style={{ fontSize:12.5, color: T.muted }}>
              No account?{' '}
              <Link href="/auth/signup" style={{
                color: T.ai, textDecoration:'none', fontWeight:600,
              }}>
                Start free 14-day trial →
              </Link>
            </p>
            <p style={{
              fontSize:10, color: T.dim,
              fontFamily:"'SF Mono','Courier New',monospace",
              letterSpacing:'0.04em',
            }}>
              PIOS v3.0.2 · VeritasIQ Technologies Ltd
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
