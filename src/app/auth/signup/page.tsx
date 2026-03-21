'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────────────
// PIOS — Sign Up / Onboarding
// Google OAuth (primary) or email+password
// ─────────────────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const [mode, setMode]         = useState<'google' | 'email'>('google')
  const [step, setStep]         = useState<1 | 2>(1)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [form, setForm]         = useState({
    email: '', password: '', full_name: '', job_title: '', organisation: '',
    programme_name: '', university: 'University of Portsmouth',
  })
  const supabase = createClient()
  const router   = useRouter()

  function f(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function signUpWithGoogle() {
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  async function signUpWithEmail() {
    if (step === 1) {
      if (!form.email || !form.password || !form.full_name) {
        setError('Please fill in all required fields.'); return
      }
      if (form.password.length < 8) {
        setError('Password must be at least 8 characters.'); return
      }
      setStep(2); setError(null); return
    }

    // Step 2 — create account
    setLoading(true); setError(null)
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            job_title: form.job_title,
            organisation: form.organisation,
            programme_name: form.programme_name,
            university: form.university,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }
      router.push('/auth/verify?email=' + encodeURIComponent(form.email))
    } catch (err: any) {
      setError(err.message ?? 'Sign up failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0b0d', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <style>{`
        * { box-sizing: border-box }
        input { background:#141520!important; border:1px solid rgba(255,255,255,0.1)!important; border-radius:8px!important; padding:10px 14px!important; color:#f1f5f9!important; font-size:13px!important; width:100%!important; outline:none!important; transition:border-color 0.15s!important }
        input:focus { border-color:rgba(167,139,250,0.5)!important }
        input::placeholder { color:#475569!important }
        select { background:#141520!important; border:1px solid rgba(255,255,255,0.1)!important; border-radius:8px!important; padding:10px 14px!important; color:#f1f5f9!important; font-size:13px!important; width:100%!important; outline:none!important }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      <div style={{ width:'100%', maxWidth:440 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:48, height:48, borderRadius:12, background:'linear-gradient(135deg,#a78bfa,#6c8eff)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, color:'#fff', marginBottom:12 }}>P</div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#f1f5f9', marginBottom:4 }}>Create your PIOS account</h1>
          <p style={{ fontSize:13, color:'#64748b' }}>Your personal intelligent operating system</p>
        </div>

        <div style={{ background:'#0f1117', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:28 }}>

          {/* Step indicator */}
          {mode === 'email' && (
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              {[1,2].map(s=>(
                <div key={s} style={{ flex:1, height:3, borderRadius:2, background:step>=s?'#a78bfa':'rgba(255,255,255,0.1)', transition:'background 0.3s' }} />
              ))}
            </div>
          )}

          {/* Mode tabs */}
          {step === 1 && (
            <div style={{ display:'flex', gap:4, padding:4, borderRadius:10, background:'rgba(255,255,255,0.04)', marginBottom:20 }}>
              {[['google','Google'],['email','Email']].map(([m,l])=>(
                <button key={m} onClick={()=>{ setMode(m as any); setError(null) }} style={{ flex:1, padding:'8px', borderRadius:7, border:'none', fontSize:13, fontWeight:mode===m?600:400, background:mode===m?'rgba(167,139,250,0.2)':'transparent', color:mode===m?'#a78bfa':'#64748b', cursor:'pointer', transition:'all 0.15s' }}>{l}</button>
              ))}
            </div>
          )}

          {error && (
            <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444', fontSize:12, marginBottom:16 }}>
              {error}
            </div>
          )}

          {/* Google OAuth */}
          {mode === 'google' && (
            <div>
              <button onClick={signUpWithGoogle} disabled={loading} style={{ width:'100%', padding:'12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'#f1f5f9', fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'background 0.15s' }}>
                {loading ? <div style={{ width:16, height:16, border:'2px solid rgba(167,139,250,0.3)', borderTop:'2px solid #a78bfa', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                  : <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
                {loading ? 'Connecting…' : 'Continue with Google'}
              </button>
              <p style={{ fontSize:11, color:'#475569', textAlign:'center', marginTop:12, lineHeight:1.65 }}>
                Recommended — grants Gmail, Calendar, and Drive access in one step.
              </p>
            </div>
          )}

          {/* Email signup — step 1 */}
          {mode === 'email' && step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:6 }}>Full name *</div>
                <input placeholder="Douglas Masuku" value={form.full_name} onChange={e=>f('full_name',e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:6 }}>Email address *</div>
                <input type="email" placeholder="you@example.com" value={form.email} onChange={e=>f('email',e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:6 }}>Password * (min. 8 characters)</div>
                <input type="password" placeholder="••••••••" value={form.password} onChange={e=>f('password',e.target.value)} />
              </div>
              <button onClick={signUpWithEmail} style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#a78bfa,#6c8eff)', color:'#0a0b0d', fontSize:14, fontWeight:700, cursor:'pointer', marginTop:4 }}>
                Continue →
              </button>
            </div>
          )}

          {/* Email signup — step 2: profile */}
          {mode === 'email' && step === 2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#f1f5f9', marginBottom:2 }}>Tell us about yourself</div>
              <p style={{ fontSize:12, color:'#64748b', lineHeight:1.65 }}>
                Optional — helps PIOS personalise your brief and AI companion.
              </p>
              {[
                { label:'Job title', key:'job_title', placeholder:'Group CEO / Founder' },
                { label:'Organisation', key:'organisation', placeholder:'Sustain International FZE Ltd' },
                { label:'Programme / degree', key:'programme_name', placeholder:'DBA — Facilities Management' },
                { label:'University', key:'university', placeholder:'University of Portsmouth' },
              ].map(field => (
                <div key={field.key}>
                  <div style={{ fontSize:11, color:'#64748b', marginBottom:6 }}>{field.label}</div>
                  <input placeholder={field.placeholder} value={(form as any)[field.key]} onChange={e=>f(field.key,e.target.value)} />
                </div>
              ))}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button onClick={()=>setStep(1)} style={{ flex:1, padding:'11px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'#64748b', fontSize:13, cursor:'pointer' }}>← Back</button>
                <button onClick={signUpWithEmail} disabled={loading} style={{ flex:2, padding:'11px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#a78bfa,#6c8eff)', color:'#0a0b0d', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  {loading ? 'Creating account…' : 'Create PIOS account'}
                </button>
              </div>
            </div>
          )}

          <div style={{ textAlign:'center', marginTop:20, fontSize:12, color:'#475569' }}>
            Already have an account? <Link href="/auth/login" style={{ color:'#a78bfa', textDecoration:'none', fontWeight:600 }}>Sign in →</Link>
          </div>
        </div>

        <p style={{ textAlign:'center', fontSize:11, color:'#334155', marginTop:16, lineHeight:1.65 }}>
          By creating an account you agree to the{' '}
          <Link href="/privacy" style={{ color:'#a78bfa', textDecoration:'none' }}>Privacy Policy</Link>
          {' '}and confirm your data is stored securely in EU West (Ireland).
        </p>
      </div>
    </div>
  )
}
