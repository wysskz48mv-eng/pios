'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Settings — profile edit, plan, integrations, news feed prefs, system info
// ─────────────────────────────────────────────────────────────────────────────

const PLANS: Record<string,{name:string;price:number;credits:number}> = {
  student:      { name:'Student',      price:9,    credits:5000 },
  individual:   { name:'Individual',   price:19,   credits:15000 },
  professional: { name:'Professional', price:49,   credits:50000 },
}

function Section({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div className="pios-card">
      <div style={{ fontSize:14,fontWeight:600,marginBottom:16,paddingBottom:12,borderBottom:'1px solid var(--pios-border)' }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value, colour }: { label:string; value:string; colour?:string }) {
  return (
    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--pios-border)' }}>
      <span style={{ fontSize:12,color:'var(--pios-muted)' }}>{label}</span>
      <span style={{ fontSize:13,fontWeight:500,color:colour??'var(--pios-text)' }}>{value}</span>
    </div>
  )
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [tenant,  setTenant]  = useState<any>(null)
  const [user,    setUser]    = useState<any>(null)
  const [feedSettings,   setFeedSettings]   = useState<any>(null)
  const [billingNotice,  setBillingNotice]  = useState<{msg:string,ok:boolean}|null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [form, setForm] = useState({ full_name:'', programme_name:'', university:'', timezone:'Europe/London', job_title:'', organisation:'', billing_email:'' })
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data:{ user:u } } = await supabase.auth.getUser()
      setUser(u)
      if (!u) { setLoading(false); return }
      const [pR, tR, fR] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', u.id).single(),
        supabase.from('tenants').select('*').limit(1).single(),
        fetch('/api/feeds').then(r=>r.json()).catch(()=>({ settings:null })),
      ])
      setProfile(pR.data)
      setTenant(tR.data)
      setFeedSettings(fR.settings)
      if (pR.data) setForm({
        full_name: pR.data.full_name ?? '',
        billing_email: pR.data.billing_email ?? '',
        programme_name: pR.data.programme_name ?? '',
        university: pR.data.university ?? '',
        timezone: pR.data.timezone ?? 'Europe/London',
        job_title: pR.data.job_title ?? '',
        organisation: pR.data.organisation ?? '',
      })
      setLoading(false)
      // Handle Stripe portal return params
      if (typeof window !== 'undefined') {
        const p = new URLSearchParams(window.location.search)
        const b = p.get('billing')
        if (b === 'returned')       setBillingNotice({ msg:'✓ Subscription updated. Changes take effect immediately.', ok:true })
        if (b === 'error')          setBillingNotice({ msg:'Billing portal error. Please try again.', ok:false })
        if (b === 'not_subscribed') setBillingNotice({ msg:'No active subscription. Subscribe to a plan above.', ok:false })
        if (b) window.history.replaceState({}, '', '/platform/settings')
      }
    }
    load()
  }, [])

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    await supabase.from('user_profiles').update({ ...form, updated_at: new Date().toISOString() }).eq('id', user.id)
    setProfile((p:any) => ({ ...p, ...form }))
    setSaving(false); setEditing(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function updateFeedSetting(key: string, value: any) {
    const next = { ...(feedSettings??{}), [key]: value }
    setFeedSettings(next)
    await fetch('/api/feeds', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'settings', ...next }) })
  }

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh' }}>
      <div style={{ width:18,height:18,border:'2px solid rgba(167,139,250,0.2)',borderTop:'2px solid #a78bfa',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
    </div>
  )

  const plan = tenant?.plan ?? 'individual'
  const planInfo = PLANS[plan] ?? PLANS.individual
  const creditsUsed = tenant?.ai_credits_used ?? 0
  const creditsLimit = tenant?.ai_credits_limit ?? planInfo.credits
  const creditsPct = Math.min(100, (creditsUsed / creditsLimit) * 100)

  return (
    <div className="fade-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:28 }}>
        <h1 style={{ fontSize:22,fontWeight:700 }}>Settings</h1>
        {saved && <span style={{ fontSize:12,color:'#22c55e',padding:'4px 12px',borderRadius:20,background:'rgba(34,197,94,0.1)' }}>✓ Saved</span>}
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>

        {/* Profile */}
        <Section title="Profile">
          {editing ? (
            <div style={{ display:'flex',flexDirection:'column' as const,gap:10 }}>
              {[
                ['full_name','Full name'],['job_title','Job title'],['organisation','Organisation'],['billing_email','Email for daily brief'],
                ['programme_name','Programme'],['university','University'],['timezone','Timezone'],
              ].map(([k,l]) => (
                <div key={k}>
                  <div style={{ fontSize:11,color:'var(--pios-muted)',marginBottom:4 }}>{l}</div>
                  <input className="pios-input" value={(form as any)[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} />
                </div>
              ))}
              <div style={{ display:'flex',gap:8,marginTop:4 }}>
                <button className="pios-btn pios-btn-primary" onClick={saveProfile} disabled={saving} style={{ flex:1,fontSize:12 }}>{saving?'Saving…':'Save profile'}</button>
                <button className="pios-btn pios-btn-ghost" onClick={()=>setEditing(false)} style={{ fontSize:12 }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              {[
                ['Name',     profile?.full_name ?? user?.email?.split('@')[0] ?? '—'],
                ['Email',    user?.email ?? '—'],
                ['Role',     profile?.job_title ?? '—'],
                ['Organisation', profile?.organisation ?? '—'],
                ['Programme',profile?.programme_name ?? '—'],
                ['University',profile?.university ?? '—'],
                ['Timezone', profile?.timezone ?? 'Europe/London'],
              ].map(([l,v]) => <Row key={l} label={l} value={v} />)}
              <button className="pios-btn pios-btn-ghost" onClick={()=>setEditing(true)} style={{ fontSize:12,marginTop:12,width:'100%' }}>✎ Edit profile</button>
            </div>
          )}
        </Section>

        {/* Plan & Credits */}
        <Section title="Plan & AI Credits">
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
              <span style={{ fontSize:22,fontWeight:800,color:'#a78bfa' }}>{planInfo.name}</span>
              <span style={{ fontSize:11,padding:'2px 8px',borderRadius:20,background:'rgba(167,139,250,0.1)',color:'#a78bfa' }}>{tenant?.subscription_status ?? 'active'}</span>
              <span style={{ fontSize:13,color:'var(--pios-muted)',marginLeft:'auto' }}>${planInfo.price}/mo</span>
            </div>
            <div style={{ height:6,background:'var(--pios-surface2)',borderRadius:3,marginBottom:6 }}>
              <div style={{ height:'100%',width:`${creditsPct}%`,background:creditsPct>90?'#ef4444':creditsPct>70?'#f59e0b':'#a78bfa',borderRadius:3,transition:'width 0.3s' }} />
            </div>
            <div style={{ fontSize:11,color:'var(--pios-dim)' }}>{creditsUsed.toLocaleString()} / {creditsLimit.toLocaleString()} AI credits used</div>
          </div>
          <div style={{ display:'flex',flexDirection:'column' as const,gap:8 }}>
            {Object.entries(PLANS).map(([key,p]) => (
              <div key={key} style={{ padding:'10px 12px',borderRadius:8,background:plan===key?'rgba(167,139,250,0.08)':'var(--pios-surface2)',border:`1px solid ${plan===key?'rgba(167,139,250,0.3)':'transparent'}` }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <div>
                    <span style={{ fontSize:13,fontWeight:600 }}>{p.name}</span>
                    <span style={{ fontSize:11,color:'var(--pios-dim)',marginLeft:8 }}>{p.credits.toLocaleString()} AI credits</span>
                  </div>
                  {plan===key?<span style={{ fontSize:11,color:'#a78bfa',fontWeight:600 }}>Current</span>
                    :<Link href={`/api/stripe/checkout?plan=${key}`} style={{ fontSize:11,color:'#6c8eff',textDecoration:'none' }}>Upgrade →</Link>}
                </div>
                <div style={{ fontSize:11,color:'var(--pios-dim)',marginTop:2 }}>${p.price}/month</div>
              </div>
            ))}
          </div>
          {tenant?.stripe_customer_id && (
            <div style={{ marginTop:14, display:'flex', gap:8, flexWrap:'wrap' as const }}>
              <Link
                href="/api/stripe/portal"
                style={{ fontSize:12, padding:'7px 14px', borderRadius:8,
                  background:'rgba(99,91,255,0.1)', border:'1px solid rgba(99,91,255,0.3)',
                  color:'#a78bfa', textDecoration:'none', fontWeight:600 }}
              >
                ⚙ Manage subscription →
              </Link>
              <span style={{ fontSize:11, color:'var(--pios-dim)', alignSelf:'center' }}>
                Update payment method · Cancel · View invoices
              </span>
            </div>
          )}
          {/* Billing status notices */}
          {billingNotice && (
            <div style={{ marginTop:10, padding:'8px 12px', borderRadius:6, fontSize:12,
              background: billingNotice.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              color: billingNotice.ok ? '#22c55e' : '#ef4444',
              border: `1px solid ${billingNotice.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              {billingNotice.msg}
            </div>
          )}
        </Section>

        {/* Integrations */}
        <Section title="Integrations">
          {[
            { name:'Google (Gmail + Calendar + Drive)', connected:!!profile?.google_email, detail:profile?.google_email ?? 'Not connected', colour:'#4285F4', note:profile?.google_email?'Reconnect to grant Drive access if not yet granted':null },
            { name:'Intelligence Feeds', connected:true, detail:'Configure in Command Centre → Intelligence Feeds', colour:'#22c55e' },
            { name:'Zotero (Research Library)', connected:false, detail:'Add Zotero Key in Research Hub → Import & Connect', colour:'#CC2936' },
            { name:'Railway (OBE + LIE Engines)', connected:false, detail:'See docs/runbooks/RAILWAY_DEPLOYMENT.md', colour:'#6c8eff' },
            { name:'Stripe (Billing)', connected:!!tenant?.stripe_customer_id, detail:'Managed automatically', colour:'#635BFF' },
          ].map(i => (
            <div key={i.name} style={{ padding:'10px 0',borderBottom:'1px solid var(--pios-border)' }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:13,fontWeight:500,marginBottom:2 }}>{i.name}</div>
                  <div style={{ fontSize:11,color:'var(--pios-dim)' }}>{i.detail}</div>
                  {i.note && <div style={{ fontSize:11,color:'#f59e0b',marginTop:2 }}>⚠ {i.note}</div>}
                </div>
                <span style={{ fontSize:11,padding:'3px 10px',borderRadius:20,background:i.connected?'rgba(34,197,94,0.1)':'rgba(255,255,255,0.05)',color:i.connected?'#22c55e':'var(--pios-dim)',flexShrink:0,marginLeft:12 }}>
                  {i.connected?'Connected':'Not connected'}
                </span>
              </div>
            </div>
          ))}
          <button
            onClick={async()=>{
              const supabase=createClient()
              await supabase.auth.signInWithOAuth({
                provider:'google',
                options:{
                  redirectTo:`${window.location.origin}/auth/callback`,
                  scopes:'email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
                  queryParams:{access_type:'offline',prompt:'consent'},
                }
              })
            }}
            className="pios-btn pios-btn-primary"
            style={{ fontSize:12, marginTop:12, width:'100%' }}
          >
            {profile?.google_email ? '↻ Reconnect Google (refresh scopes)' : 'Connect Google Account'}
          </button>
        </Section>

        {/* News & Intelligence preferences */}
        <Section title="News & Intelligence">
          <p style={{ fontSize:12,color:'var(--pios-muted)',lineHeight:1.65,marginBottom:14 }}>
            Configure how your intelligence feeds appear in the Command Centre and morning brief.
          </p>
          {feedSettings ? (
            <div style={{ display:'flex',flexDirection:'column' as const,gap:12 }}>
              {[
                { key:'brief_include_feeds', label:'Include feeds in morning brief', type:'checkbox' },
                { key:'auto_refresh', label:'Auto-refresh feeds on Command Centre load', type:'checkbox' },
                { key:'show_relevance', label:'Show AI relevance scores on feed items', type:'checkbox' },
              ].map(opt=>(
                <label key={opt.key} style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:13 }}>
                  <input type="checkbox" checked={!!(feedSettings as any)[opt.key]} onChange={e=>updateFeedSetting(opt.key, e.target.checked)} />
                  {opt.label}
                </label>
              ))}
              <div>
                <div style={{ fontSize:11,color:'var(--pios-muted)',marginBottom:6 }}>Brief feed items count (how many top items to include)</div>
                <input type="number" className="pios-input" min={1} max={10} value={feedSettings.brief_feed_count??3} onChange={e=>updateFeedSetting('brief_feed_count',parseInt(e.target.value)||3)} style={{ width:80 }} />
              </div>
              <Link href="/platform/command" style={{ fontSize:12,color:'#6c8eff',textDecoration:'none' }}>Manage feed topics →</Link>
            </div>
          ) : (
            <div style={{ fontSize:12,color:'var(--pios-dim)' }}>Run migration 005 to enable intelligence feeds. <Link href="/platform/command" style={{ color:'#6c8eff' }}>Go to Command Centre →</Link></div>
          )}
        </Section>

        {/* System info */}
        <Section title="System">
          {[
            ['PIOS Version',    'v2.0.0'],
            ['AI Engine',       'claude-sonnet-4-6'],
            ['Database',        'Supabase PostgreSQL (EU West)'],
            ['Deployment',      'Vercel'],
            ['Owner',           'Sustain International FZE Ltd'],
            ['Migrations run',  '001–007'],
          ].map(([l,v])=>(
            <div key={l} style={{ display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--pios-border)' }}>
              <span style={{ fontSize:12,color:'var(--pios-muted)' }}>{l}</span>
              <span style={{ fontSize:12,fontFamily:'monospace',color:'var(--pios-text)' }}>{v}</span>
            </div>
          ))}
          <Link href="/platform/setup" style={{ display:'block',fontSize:12,color:'#f59e0b',textDecoration:'none',marginTop:14,padding:'8px 16px',borderRadius:8,border:'1px solid rgba(245,158,11,0.25)',background:'rgba(245,158,11,0.06)',textAlign:'center' as const }}>
            ⚡ Phase 2 Setup Guide →
          </Link>
          <button onClick={async()=>{const supabase=createClient();await supabase.auth.signOut();window.location.href='/auth/login'}} style={{ fontSize:12,padding:'8px 16px',borderRadius:8,border:'1px solid rgba(239,68,68,0.3)',background:'none',cursor:'pointer',color:'#ef4444',marginTop:8,width:'100%' }}>
            Sign out
          </button>
        </Section>
      </div>
    </div>
  )
}
