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

  const MANIFESTO = [
    { n: '01', bold: 'Clarity for the C-Suite.', rest: ' Every decision, every OKR, every stakeholder brief — one command centre.' },
    { n: '02', bold: 'Strategic memory. Instant execution.', rest: ' NemoClaw™ AI holds your context so you never lose momentum.' },
    { n: '03', bold: 'Your legacy, optimized.', rest: ' Academic rigour and executive power — running in parallel, not in conflict.' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .pl-root{min-height:100vh;display:grid;grid-template-columns:1fr;background:#060606;font-family:'DM Sans',system-ui,sans-serif}
        @media(min-width:900px){.pl-root{grid-template-columns:54% 1fr}}
        .pl-left{display:none;background:#0a0a0a;border-right:1px solid rgba(255,255,255,0.07);padding:48px 52px;flex-direction:column;position:relative;overflow:hidden}
        @media(min-width:900px){.pl-left{display:flex}}
        .pl-right{display:flex;flex-direction:column;justify-content:center;align-items:center;padding:40px 24px;min-height:100vh}
        @media(min-width:900px){.pl-right{padding:52px 44px}}
        .pl-card{width:100%;max-width:400px;animation:pl-up .3s cubic-bezier(.16,1,.3,1) both}
        @keyframes pl-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .pl-mobile-head{text-align:center;margin-bottom:36px}
        @media(min-width:900px){.pl-mobile-head{display:none}}
        .pl-desk-head{margin-bottom:24px}
        @media(max-width:899px){.pl-desk-head{display:none}}
        .pl-manifesto-row{border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:flex-start;gap:14px;padding:11px 0}
        .pl-manifesto-row:last-child{border-bottom:none}
        .pl-gbtn:hover:not(:disabled){background:rgba(255,255,255,0.07)!important;border-color:rgba(255,255,255,0.14)!important}
        .pl-field:focus-within{border-color:rgba(99,73,255,0.5)!important;box-shadow:0 0 0 3px rgba(99,73,255,0.09)!important}
        .pl-send:hover:not(:disabled){opacity:.88}
        .pl-link{color:rgba(99,73,255,0.85);text-decoration:none;font-weight:500}
        .pl-link:hover{color:#6349FF}
      `}</style>

      <div className="pl-root">

        {/* ── LEFT brand panel ─────────────────────────── */}
        <div className="pl-left">
          <div style={{position:'absolute',top:-120,left:-80,width:520,height:520,borderRadius:'50%',background:'radial-gradient(ellipse,rgba(99,73,255,.13) 0%,transparent 62%)',pointerEvents:'none'}}/>
          <div style={{position:'absolute',bottom:-80,right:-60,width:300,height:300,borderRadius:'50%',background:'radial-gradient(ellipse,rgba(99,73,255,.05) 0%,transparent 70%)',pointerEvents:'none'}}/>

          {/* Wordmark */}
          <div style={{display:'flex',alignItems:'center',gap:10,position:'relative',zIndex:1}}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <polygon points="14,1.5 24.4,7.5 24.4,20.5 14,26.5 3.6,20.5 3.6,7.5" fill="rgba(99,73,255,.1)" stroke="rgba(99,73,255,.42)" strokeWidth="1"/>
              <text x="14" y="18" textAnchor="middle" style={{fontFamily:'Georgia,serif',fontWeight:900,fontSize:10,fill:'rgba(130,108,255,.88)'}}>P</text>
            </svg>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:500,color:'rgba(255,255,255,.9)',letterSpacing:'.06em'}}>PIOS</span>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'rgba(255,255,255,.18)',letterSpacing:'.08em',marginLeft:2}}>v3.0 · VeritasIQ</span>
          </div>

          {/* Hero */}
          <div style={{position:'relative',zIndex:1,marginTop:'auto',marginBottom:'auto',paddingTop:48,paddingBottom:40}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
              <div style={{width:20,height:1,background:'rgba(99,73,255,.6)',flexShrink:0}}/>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:'rgba(99,73,255,.82)',letterSpacing:'.14em',textTransform:'uppercase' as const}}>The operating system for the relentless</span>
            </div>
            <h1 style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:40,lineHeight:1.1,letterSpacing:'-.028em',color:'#fff',marginBottom:10}}>
              Unifying the <em style={{fontStyle:'italic',color:'rgba(130,108,255,.92)'}}>art</em> of leadership<br/>
              with the <em style={{fontStyle:'italic',color:'rgba(130,108,255,.92)'}}>science</em><br/>
              of intelligence.
            </h1>
            <p style={{fontSize:13,color:'rgba(255,255,255,.3)',fontStyle:'italic',marginBottom:28}}>Built for those who build empires.</p>
            <div>
              {MANIFESTO.map(m => (
                <div key={m.n} className="pl-manifesto-row">
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'rgba(99,73,255,.5)',minWidth:20,paddingTop:2,flexShrink:0}}>{m.n}</span>
                  <p style={{fontSize:13,color:'rgba(255,255,255,.48)',lineHeight:1.6}}>
                    <strong style={{color:'rgba(255,255,255,.86)',fontWeight:500}}>{m.bold}</strong>{m.rest}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Stats footer */}
          <div style={{position:'relative',zIndex:1}}>
            <div style={{height:1,background:'rgba(255,255,255,.06)',marginBottom:16}}/>
            <div style={{display:'flex',gap:24,marginBottom:14}}>
              {[['41','Platform modules'],['15','Proprietary frameworks'],['3','Intelligence domains']].map(([v,l])=>(
                <div key={l}>
                  <div style={{fontFamily:"'Instrument Serif',serif",fontSize:19,color:'rgba(255,255,255,.85)',lineHeight:1}}>{v}</div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,.22)',marginTop:3}}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'rgba(255,255,255,.14)',letterSpacing:'.04em'}}>© 2026 VeritasIQ Technologies Ltd · info@veritasiq.io</div>
          </div>
        </div>

        {/* ── RIGHT form panel ─────────────────────────── */}
        <div className="pl-right">
          <div className="pl-card">

            {/* Mobile header */}
            <div className="pl-mobile-head">
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style={{margin:'0 auto 14px',display:'block'}}>
                <polygon points="26,2 48,14.5 48,37.5 26,50 4,37.5 4,14.5" fill="rgba(99,73,255,.1)" stroke="rgba(99,73,255,.42)" strokeWidth="1.5"/>
                <text x="26" y="33" textAnchor="middle" style={{fontFamily:'Georgia,serif',fontWeight:900,fontSize:18,fill:'rgba(130,108,255,.88)'}}>P</text>
              </svg>
              <h2 style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:26,fontWeight:400,color:'#fff',letterSpacing:'-.025em',marginBottom:6}}>Welcome back.</h2>
              <p style={{fontSize:13,color:'rgba(255,255,255,.28)'}}>The operating system for the relentless</p>
            </div>

            {/* Form card */}
            <div style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.10)',borderRadius:16,padding:'32px 30px',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:1.5,background:'linear-gradient(90deg,#6349FF,rgba(79,142,247,.7) 60%,transparent)'}}/>

              {sent ? (
                <div style={{textAlign:'center',padding:'16px 0 8px'}}>
                  <div style={{width:60,height:60,borderRadius:'50%',margin:'0 auto 18px',background:'rgba(99,73,255,.1)',border:'1px solid rgba(99,73,255,.25)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(99,73,255,.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <h3 style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:20,fontWeight:400,marginBottom:10,color:'#fff'}}>Check your inbox.</h3>
                  <p style={{fontSize:13,color:'rgba(255,255,255,.36)',lineHeight:1.7}}>
                    Magic link sent to<br/>
                    <strong style={{color:'rgba(255,255,255,.8)',fontWeight:500}}>{email}</strong>
                  </p>
                  <button onClick={()=>{setSent(false);setEmail('')}} style={{marginTop:22,background:'none',border:'none',color:'rgba(99,73,255,.8)',fontSize:12.5,cursor:'pointer',fontFamily:'inherit'}}>
                    ← Use a different email
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop card heading */}
                  <div className="pl-desk-head">
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9.5,color:'rgba(99,73,255,.65)',letterSpacing:'.16em',textTransform:'uppercase' as const,marginBottom:14}}>Secure workspace access</div>
                    <h2 style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:28,fontWeight:400,color:'#fff',letterSpacing:'-.022em',marginBottom:5,lineHeight:1.1}}>Welcome back.</h2>
                    <p style={{fontSize:12.5,color:'rgba(255,255,255,.28)',lineHeight:1.6}}>Sign in to your PIOS command centre</p>
                  </div>

                  {/* Google */}
                  <button onClick={handleGoogle} disabled={loading} className="pl-gbtn" style={{
                    width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:9,
                    padding:'11.5px 16px',borderRadius:9,cursor:loading?'not-allowed':'pointer',
                    background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',
                    color:'rgba(255,255,255,.6)',fontSize:13,fontFamily:'inherit',
                    marginBottom:18,transition:'all .15s',opacity:loading?.5:1,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 18 18">
                      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                      <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
                      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
                    </svg>
                    Continue with Google
                  </button>

                  {/* Divider */}
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
                    <div style={{flex:1,height:1,background:'rgba(255,255,255,.06)'}}/>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'rgba(255,255,255,.16)',letterSpacing:'.14em'}}>OR</span>
                    <div style={{flex:1,height:1,background:'rgba(255,255,255,.06)'}}/>
                  </div>

                  {/* Magic link form */}
                  <form onSubmit={handleMagicLink}>
                    <label style={{display:'block',fontFamily:"'DM Mono',monospace",fontSize:9.5,color:'rgba(255,255,255,.26)',letterSpacing:'.1em',textTransform:'uppercase' as const,marginBottom:8}}>
                      Email address
                    </label>
                    <div className="pl-field" style={{
                      display:'flex',borderRadius:9,overflow:'hidden',
                      border:`1px solid ${error?'rgba(239,68,68,.4)':'rgba(255,255,255,.10)'}`,
                      background:'rgba(255,255,255,.03)',
                      marginBottom:error?8:0,transition:'border-color .15s,box-shadow .15s',
                    }}>
                      <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                        placeholder="you@domain.com" required
                        style={{flex:1,padding:'12px 14px',background:'transparent',border:'none',outline:'none',color:'#fff',fontSize:13.5,fontFamily:'inherit'}}
                      />
                      <button type="submit" disabled={loading||!email} className="pl-send" style={{
                        padding:'10px 18px',
                        background:loading||!email?'rgba(99,73,255,.35)':'#6349FF',
                        border:'none',color:'#fff',fontSize:13,fontWeight:600,fontFamily:'inherit',
                        cursor:loading||!email?'not-allowed':'pointer',whiteSpace:'nowrap' as const,transition:'opacity .15s',
                      }}>
                        {loading?'Sending…':'Send link →'}
                      </button>
                    </div>
                    {error&&(
                      <p style={{display:'flex',alignItems:'center',gap:6,color:'#f87171',fontSize:12,marginTop:8}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        {error}
                      </p>
                    )}
                  </form>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{textAlign:'center',marginTop:20,display:'flex',flexDirection:'column',gap:7}}>
              <p style={{fontSize:12,color:'rgba(255,255,255,.22)'}}>
                No account?{' '}
                <Link href="/auth/signup" className="pl-link">Start free 14-day trial →</Link>
              </p>
              <p style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'rgba(255,255,255,.1)',letterSpacing:'.05em'}}>
                PIOS v3.0.3 · VeritasIQ Technologies Ltd
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
