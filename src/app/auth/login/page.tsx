'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')
  const [wide,    setWide]    = useState(false)

  useEffect(() => {
    const check = () => setWide(window.innerWidth >= 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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

  const C = {
    black:   '#080808',
    black2:  '#060606',
    panel:   '#0a0a0a',
    border:  'rgba(255,255,255,0.07)',
    border2: 'rgba(255,255,255,0.10)',
    text:    '#ffffff',
    sub:     'rgba(255,255,255,0.55)',
    muted:   'rgba(255,255,255,0.26)',
    dim:     'rgba(255,255,255,0.14)',
    violet:  '#6349FF',
    violetDim: 'rgba(99,73,255,0.65)',
    violetGlow: 'rgba(99,73,255,0.13)',
  }

  const HexMark = ({ size = 28 }: { size?: number }) => {
    const cx = size / 2, pts = (r: number) =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6
        return `${(cx + r * Math.cos(a)).toFixed(2)},${(cx + r * Math.sin(a)).toFixed(2)}`
      }).join(' ')
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" style={{ flexShrink: 0 }}>
        <polygon points={pts(cx - 1.5)} fill="rgba(99,73,255,0.10)" stroke="rgba(99,73,255,0.42)" strokeWidth="1"/>
        <polygon points={pts((cx - 1.5) * 0.62)} fill="none" stroke="rgba(99,73,255,0.18)" strokeWidth="0.6"/>
        <text x={cx} y={cx + size * 0.16} textAnchor="middle"
          style={{ fontFamily: 'Georgia,serif', fontWeight: 900, fontSize: size * 0.34, fill: 'rgba(130,108,255,0.88)' }}>
          P
        </text>
      </svg>
    )
  }

  const MANIFESTO = [
    { n: '01', bold: 'Clarity for the C-Suite.', rest: ' Every decision, every OKR, every stakeholder brief — one command centre.' },
    { n: '02', bold: 'Strategic memory. Instant execution.', rest: ' NemoClaw™ AI holds your context so you never lose momentum.' },
    { n: '03', bold: 'Your legacy, optimized.', rest: ' Academic rigour and executive power — running in parallel, not in conflict.' },
  ]

  const s = {
    root: {
      minHeight: '100vh', display: 'flex',
      background: C.black,
      fontFamily: "'DM Sans','Plus Jakarta Sans',system-ui,sans-serif",
    } as React.CSSProperties,
    left: {
      width: '54%', flexShrink: 0,
      background: C.panel,
      borderRight: `1px solid ${C.border}`,
      padding: '48px 52px',
      display: 'flex', flexDirection: 'column' as const,
      justifyContent: 'space-between',
      position: 'relative' as const, overflow: 'hidden',
    },
    right: {
      flex: 1, display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'center',
      padding: wide ? '52px 48px' : '40px 24px',
      background: C.black2,
      minHeight: '100vh',
    },
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        .pios-login-card { animation: fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both }
        .pios-g-btn:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.14) !important; }
        .pios-field-wrap:focus-within { border-color: rgba(99,73,255,0.5) !important; box-shadow: 0 0 0 3px rgba(99,73,255,0.09) !important; }
        .pios-send-btn:hover:not(:disabled) { opacity: 0.88; }
        .pios-trial-link { color: rgba(99,73,255,0.85); text-decoration: none; font-weight: 500; }
        .pios-trial-link:hover { color: #6349FF; }
        .pios-manifesto-item { border-bottom: 1px solid rgba(255,255,255,0.05); }
        .pios-manifesto-item:last-child { border-bottom: none; }
      `}</style>

      <div style={s.root}>

        {/* ── LEFT: Brand panel (desktop only) ── */}
        {wide && (
          <div style={s.left}>

            {/* Ambient glows */}
            <div style={{ position:'absolute', top:-120, left:-80, width:520, height:520, borderRadius:'50%', background:`radial-gradient(ellipse, ${C.violetGlow} 0%, transparent 62%)`, pointerEvents:'none' }} />
            <div style={{ position:'absolute', bottom:-80, right:-60, width:300, height:300, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(99,73,255,0.05) 0%, transparent 70%)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, background:'linear-gradient(90deg, transparent, rgba(99,73,255,0.07), transparent)', pointerEvents:'none' }} />

            {/* Logo */}
            <div style={{ display:'flex', alignItems:'center', gap:10, position:'relative', zIndex:1 }}>
              <HexMark size={28} />
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:500, color:'rgba(255,255,255,0.9)', letterSpacing:'0.06em' }}>PIOS</span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'rgba(255,255,255,0.18)', letterSpacing:'0.08em', marginLeft:2 }}>v3.0 · VeritasIQ</span>
            </div>

            {/* Hero copy */}
            <div style={{ position:'relative', zIndex:1 }}>

              {/* Eyebrow */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                <div style={{ width:20, height:1, background:'rgba(99,73,255,0.6)', flexShrink:0 }} />
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'rgba(99,73,255,0.82)', letterSpacing:'0.14em', textTransform:'uppercase' as const }}>
                  The operating system for the relentless
                </span>
              </div>

              {/* Headline */}
              <h1 style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontSize:40, lineHeight:1.1, letterSpacing:'-0.028em', color:'#fff', marginBottom:10 }}>
                Unifying the <em style={{ fontStyle:'italic', color:'rgba(130,108,255,0.92)' }}>art</em> of leadership<br />
                with the <em style={{ fontStyle:'italic', color:'rgba(130,108,255,0.92)' }}>science</em><br />
                of intelligence.
              </h1>

              {/* Sub */}
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.3)', fontStyle:'italic', letterSpacing:'0.01em', marginBottom:28 }}>
                Built for those who build empires.
              </p>

              {/* Manifesto */}
              <div>
                {MANIFESTO.map(m => (
                  <div key={m.n} className="pios-manifesto-item" style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'11px 0' }}>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'rgba(99,73,255,0.5)', letterSpacing:'0.06em', minWidth:20, paddingTop:2, flexShrink:0 }}>{m.n}</span>
                    <p style={{ fontSize:13, color:'rgba(255,255,255,0.48)', lineHeight:1.6, letterSpacing:'-0.005em' }}>
                      <strong style={{ color:'rgba(255,255,255,0.86)', fontWeight:500 }}>{m.bold}</strong>
                      {m.rest}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ position:'relative', zIndex:1 }}>
              <div style={{ height:1, background:'rgba(255,255,255,0.06)', marginBottom:16 }} />
              <div style={{ display:'flex', gap:24, marginBottom:14 }}>
                {[['41','Platform modules'],['15','Proprietary frameworks'],['3','Intelligence domains']].map(([v, l]) => (
                  <div key={l}>
                    <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:19, color:'rgba(255,255,255,0.85)', lineHeight:1 }}>{v}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.22)', marginTop:3, letterSpacing:'0.02em' }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'rgba(255,255,255,0.14)', letterSpacing:'0.04em' }}>
                © 2026 VeritasIQ Technologies Ltd · info@veritasiq.io
              </div>
            </div>
          </div>
        )}

        {/* ── RIGHT: Form panel ── */}
        <div style={s.right}>
          <div className="pios-login-card" style={{ width:'100%', maxWidth:400, margin:'0 auto' }}>

            {/* Mobile logo */}
            {!wide && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', marginBottom:36 }}>
                <HexMark size={52} />
                <h2 style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontSize:26, fontWeight:400, color:'#fff', letterSpacing:'-0.025em', marginTop:14, marginBottom:6 }}>
                  Welcome back.
                </h2>
                <p style={{ fontSize:13, color:'rgba(255,255,255,0.28)' }}>
                  The operating system for the relentless
                </p>
              </div>
            )}

            {/* Card */}
            <div style={{
              background: wide ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${C.border2}`,
              borderRadius: 16,
              padding: wide ? '32px 30px' : '28px 24px',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Top accent */}
              <div style={{ position:'absolute', top:0, left:0, right:0, height:1.5, background:`linear-gradient(90deg, ${C.violet}, rgba(79,142,247,0.7) 60%, transparent)` }} />

              {sent ? (
                /* Sent state */
                <div style={{ textAlign:'center', padding:'16px 0 8px' }}>
                  <div style={{
                    width:60, height:60, borderRadius:'50%', margin:'0 auto 18px',
                    background:'rgba(99,73,255,0.1)', border:'1px solid rgba(99,73,255,0.25)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(99,73,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <h3 style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontSize:20, fontWeight:400, letterSpacing:'-0.02em', marginBottom:10, color:'#fff' }}>
                    Check your inbox.
                  </h3>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.36)', lineHeight:1.7 }}>
                    Magic link sent to<br />
                    <strong style={{ color:'rgba(255,255,255,0.8)', fontWeight:500 }}>{email}</strong>
                  </p>
                  <button onClick={() => { setSent(false); setEmail('') }} style={{
                    marginTop:22, background:'none', border:'none',
                    color:'rgba(99,73,255,0.8)', fontSize:12.5, cursor:'pointer',
                    fontFamily:'inherit', letterSpacing:'0.01em',
                  }}>← Use a different email</button>
                </div>

              ) : (
                <>
                  {/* Desktop heading */}
                  {wide && (
                    <div style={{ marginBottom:24 }}>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9.5, color:C.violetDim, letterSpacing:'0.16em', textTransform:'uppercase' as const, marginBottom:14 }}>
                        Secure workspace access
                      </div>
                      <h2 style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontSize:28, fontWeight:400, color:'#fff', letterSpacing:'-0.022em', marginBottom:5, lineHeight:1.1 }}>
                        Welcome back.
                      </h2>
                      <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.28)', lineHeight:1.6 }}>
                        Sign in to your PIOS command centre
                      </p>
                    </div>
                  )}

                  {/* Google */}
                  <button
                    onClick={handleGoogle}
                    disabled={loading}
                    className="pios-g-btn"
                    style={{
                      width:'100%', display:'flex', alignItems:'center', justifyContent:'center',
                      gap:9, padding:'11.5px 16px', borderRadius:9, cursor:'pointer',
                      background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`,
                      color:'rgba(255,255,255,0.6)', fontSize:13, fontFamily:'inherit',
                      marginBottom:18, transition:'all 0.15s', opacity: loading ? 0.5 : 1,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 18 18" style={{ flexShrink:0 }}>
                      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                      <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
                      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
                    </svg>
                    Continue with Google
                  </button>

                  {/* OR divider */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
                    <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'rgba(255,255,255,0.16)', letterSpacing:'0.14em' }}>OR</span>
                    <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
                  </div>

                  {/* Magic link form */}
                  <form onSubmit={handleMagicLink}>
                    <label style={{ display:'block', fontFamily:"'DM Mono',monospace", fontSize:9.5, color:'rgba(255,255,255,0.26)', letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:8 }}>
                      Email address
                    </label>

                    {/* Fused input + button */}
                    <div
                      className="pios-field-wrap"
                      style={{
                        display:'flex', borderRadius:9, overflow:'hidden',
                        border:`1px solid ${error ? 'rgba(239,68,68,0.4)' : C.border2}`,
                        background:'rgba(255,255,255,0.03)',
                        marginBottom: error ? 8 : 0,
                        transition:'border-color 0.15s, box-shadow 0.15s',
                      }}
                    >
                      <input
                        type="email" value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        required
                        style={{
                          flex:1, padding:'12px 14px',
                          background:'transparent', border:'none', outline:'none',
                          color:'#fff', fontSize:13.5, fontFamily:'inherit',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={loading || !email}
                        className="pios-send-btn"
                        style={{
                          padding:'10px 18px',
                          background: loading || !email ? 'rgba(99,73,255,0.35)' : C.violet,
                          border:'none', color:'#fff',
                          fontSize:13, fontWeight:600, fontFamily:'inherit',
                          cursor: loading || !email ? 'not-allowed' : 'pointer',
                          whiteSpace:'nowrap' as const,
                          letterSpacing:'-0.01em',
                          transition:'opacity 0.15s',
                        }}
                      >
                        {loading ? 'Sending…' : 'Send link →'}
                      </button>
                    </div>

                    {error && (
                      <p style={{ display:'flex', alignItems:'center', gap:6, color:'#f87171', fontSize:12, marginTop:8 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink:0 }}>
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        {error}
                      </p>
                    )}
                  </form>
                </>
              )}
            </div>

            {/* Footer links */}
            <div style={{ textAlign:'center', marginTop:20, display:'flex', flexDirection:'column', gap:7 }}>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.22)' }}>
                No account?{' '}
                <Link href="/auth/signup" className="pios-trial-link">
                  Start free 14-day trial →
                </Link>
              </p>
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'rgba(255,255,255,0.1)', letterSpacing:'0.05em' }}>
                PIOS v3.0.2 · VeritasIQ Technologies Ltd
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
