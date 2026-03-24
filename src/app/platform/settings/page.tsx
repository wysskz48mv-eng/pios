'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────────────────────
// Settings — profile edit, plan, integrations, email accounts, news feed prefs
// PIOS v2.7 | VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

const CONTEXT_LABELS: Record<string, string> = {
  personal:'Personal', academic:'Academic / University', work:'Work',
  secondment:'Secondment', consulting:'FM Consulting', client:'Client', other:'Other',
}
const CONTEXT_COLOURS: Record<string, string> = {
  personal:'#6c8eff', academic:'#a78bfa', work:'#22c55e',
  secondment:'#f59e0b', consulting:'#0ECFB0', client:'#f97316', other:'#64748b',
}
const PROVIDER_LABELS: Record<string, string> = { google:'Gmail / Google', microsoft:'Microsoft 365 / Outlook', imap:'IMAP (App Password)' }
const PROVIDER_COLOURS: Record<string, string> = { google:'#4285F4', microsoft:'#0078D4', imap:'#64748b' }

function EmailAccountsSection() {
  const [accounts, setAccounts]   = useState<EmailAccount[]>([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [addProvider, setAddProvider] = useState<'google'|'microsoft'|'imap'>('google')
  const [addCtx, setAddCtx]       = useState('personal')
  const [addLabel, setAddLabel]   = useState('')
  const [imapForm, setImapForm]   = useState({ email:'', host:'outlook.office365.com', port:'993', username:'', password:'' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string|null>(null)
  const [syncing, setSyncing]     = useState<string|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/email/accounts')
    if (res.ok) { const d = await res.json(); setAccounts((d.accounts ?? []) as ConnectedAccount[]) }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    // Handle OAuth redirect success/error
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const err = params.get('error')
    if (connected) { window.history.replaceState({}, '', window.location.pathname); load() }
    if (err) { setError(decodeURIComponent(err)); window.history.replaceState({}, '', window.location.pathname) }
  }, [load])

  async function connectGoogle() {
    const supabase = createClient()
    if (accounts.length === 0) {
      // Primary Google — use Supabase OAuth (sets session)
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.readonly',
          queryParams: { access_type: 'offline', prompt: 'consent' },
        }
      })
    } else {
      // Additional Google — route via accounts API (future: separate Google OAuth for additional accounts)
      setError('To add a second Google account, use IMAP with an app password from myaccount.google.com → Security → App passwords.')
    }
  }

  async function connectMicrosoft() {
    const ctx = addCtx || 'personal'
    const lbl = addLabel || CONTEXT_LABELS[ctx] || ''
    window.location.href = `/api/auth/connect-microsoft?context=${ctx}&label=${encodeURIComponent(lbl)}`
  }

  async function addImap() {
    if (!imapForm.email || !imapForm.password) { setError('Email and app password required'); return }
    setSaving(true); setError(null)
    const res = await fetch('/api/email/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'imap',
        email_address: imapForm.email,
        context: addCtx,
        label: addLabel || CONTEXT_LABELS[addCtx],
        imap_host: imapForm.host,
        imap_port: parseInt(imapForm.port),
        imap_username: imapForm.username || imapForm.email,
        imap_password: imapForm.password,
      }),
    })
    const d = await res.json()
    if (res.ok) { setShowAdd(false); setImapForm({ email:'', host:'outlook.office365.com', port:'993', username:'', password:'' }); await load() }
    else setError(d.error ?? 'Failed to add account')
    setSaving(false)
  }

  async function disconnect(id: string) {
    await fetch(`/api/email/accounts?id=${id}`, { method: 'DELETE' })
    await load()
  }

  async function setPrimary(id: string) {
    await fetch('/api/email/accounts', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, is_primary: true }) })
    await load()
  }

  async function toggleReceipts(id: string, current: boolean) {
    await fetch('/api/email/accounts', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, receipt_scan_enabled: !current }) })
    await load()
  }

  async function syncAccount(id: string) {
    setSyncing(id)
    await fetch('/api/email/sync', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ account_id: id }) })
    setSyncing(null)
    await load()
  }

  const inp: React.CSSProperties = { width:'100%', background:'var(--pios-surface2)', border:'1px solid var(--pios-border)', borderRadius:6, padding:'7px 10px', color:'var(--pios-text)', fontSize:12, marginBottom:8 }

  return (
    <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'20px 22px', marginBottom:20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700 }}>Email Accounts</div>
          <div style={{ fontSize:11, color:'var(--pios-muted)', marginTop:2 }}>
            Connect multiple inboxes — Gmail, Microsoft 365, university, work, secondment
          </div>
        </div>
        <button onClick={() => { setShowAdd(!showAdd); setError(null) }}
          className="pios-btn pios-btn-primary" style={{ fontSize:11 }}>
          + Add inbox
        </button>
      </div>

      {error && (
        <div style={{ fontSize:11, color:'#ef4444', padding:'8px 12px', background:'rgba(239,68,68,0.08)', borderRadius:8, marginBottom:12, border:'1px solid rgba(239,68,68,0.2)' }}>
          ⚠ {error}
        </div>
      )}

      {/* Add account panel */}
      {showAdd && (
        <div style={{ background:'var(--pios-surface2)', border:'1px solid var(--pios-border)', borderRadius:10, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>Add email account</div>

          {/* Context */}
          <label style={{ fontSize:10, fontWeight:600, color:'var(--pios-muted)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:4 }}>Context</label>
          <select value={addCtx} onChange={e => setAddCtx(e.target.value)} style={{ ...(inp as Record<string,unknown>), marginBottom:10 }}>
            {Object.entries(CONTEXT_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>

          <label style={{ fontSize:10, fontWeight:600, color:'var(--pios-muted)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:4 }}>Label (optional)</label>
          <input placeholder={`e.g. "Portsmouth DBA" or "Sustain Work"`} value={addLabel} onChange={e => setAddLabel(e.target.value)} style={inp} />

          {/* Provider tabs */}
          <div style={{ display:'flex', gap:4, marginBottom:12, marginTop:4 }}>
            {(['google','microsoft','imap'] as const).map(p => (
              <button key={p} onClick={() => setAddProvider(p)} style={{
                padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight: addProvider===p ? 700 : 400,
                border:`1px solid ${addProvider===p ? PROVIDER_COLOURS[p] : 'var(--pios-border)'}`,
                background: addProvider===p ? PROVIDER_COLOURS[p]+'20' : 'transparent',
                color: addProvider===p ? PROVIDER_COLOURS[p] : 'var(--pios-muted)', cursor:'pointer',
              }}>{PROVIDER_LABELS[p]}</button>
            ))}
          </div>

          {addProvider === 'google' && (
            <div>
              <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:10, lineHeight:1.6 }}>
                Click below to connect your Google account via OAuth. Gmail, Calendar, and Drive access will be requested.
                {accounts.length > 0 && <span style={{ color:'#f59e0b' }}> To add a second Google account, use IMAP + app password instead.</span>}
              </div>
              <button onClick={connectGoogle} className="pios-btn pios-btn-primary" style={{ fontSize:12, width:'100%' }}>
                Connect Google Account →
              </button>
            </div>
          )}

          {addProvider === 'microsoft' && (
            <div>
              <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:10, lineHeight:1.6 }}>
                Connects via Microsoft Entra ID OAuth. Works for personal Outlook, university M365, and work M365.
                <span style={{ color:'#f59e0b' }}> If your institution blocks third-party apps, use IMAP + app password instead.</span>
              </div>
              <div style={{ fontSize:10, color:'var(--pios-dim)', padding:'8px 10px', background:'rgba(0,120,212,0.06)', borderRadius:6, marginBottom:10, lineHeight:1.5 }}>
                <strong style={{ color:'#0078D4' }}>Institutional accounts (NHS, Gov, armed forces):</strong> Your IT team may block OAuth consent for external apps. If sign-in fails, use the IMAP option with an app-specific password generated in your M365 settings.
              </div>
              <button onClick={connectMicrosoft} className="pios-btn pios-btn-primary" style={{ fontSize:12, width:'100%', background:'#0078D4', borderColor:'#0078D4' }}>
                Connect Microsoft / Outlook →
              </button>
            </div>
          )}

          {addProvider === 'imap' && (
            <div>
              <div style={{ fontSize:11, color:'var(--pios-muted)', marginBottom:8, lineHeight:1.6 }}>
                Use an app-specific password (not your main password). For Microsoft 365: account.microsoft.com → Security → App passwords. For Gmail: myaccount.google.com → Security → App passwords.
              </div>
              <input placeholder="Email address" value={imapForm.email} onChange={e => setImapForm(p=>({...p,email:e.target.value}))} style={inp} />
              <input placeholder="IMAP host (e.g. outlook.office365.com)" value={imapForm.host} onChange={e => setImapForm(p=>({...p,host:e.target.value}))} style={inp} />
              <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:8 }}>
                <input placeholder="Port (993)" value={imapForm.port} onChange={e => setImapForm(p=>({...p,port:e.target.value}))} style={{ ...(inp as Record<string,unknown>), marginBottom:0 }} />
                <input placeholder="IMAP username (usually email)" value={imapForm.username} onChange={e => setImapForm(p=>({...p,username:e.target.value}))} style={{ ...(inp as Record<string,unknown>), marginBottom:0 }} />
              </div>
              <div style={{ height:8 }} />
              <input type="password" placeholder="App password (not your main password)" value={imapForm.password} onChange={e => setImapForm(p=>({...p,password:e.target.value}))} style={inp} />
              <button onClick={addImap} disabled={saving} className="pios-btn pios-btn-primary" style={{ fontSize:12, width:'100%' }}>
                {saving ? 'Adding…' : 'Add IMAP Account'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Account list */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'20px 0', fontSize:12, color:'var(--pios-muted)' }}>Loading…</div>
      ) : accounts.length === 0 ? (
        <div style={{ textAlign:'center', padding:'20px 0', fontSize:12, color:'var(--pios-dim)' }}>
          No email accounts connected yet. Add your first inbox above.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {accounts.map((acc: Record<string, unknown>) => (
            <div key={(acc as Record<string,unknown>).id as string} style={{ padding:'12px 14px', background:'var(--pios-surface2)', borderRadius:10, border:`1px solid var(--pios-border)` }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: (PROVIDER_COLOURS as Record<string,string>)[String(acc.provider ?? '')] ?? '#64748b', flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>{String(acc.email_address ?? "")}</span>
                    {Boolean(acc.is_primary) && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:10, background:'rgba(201,168,76,0.15)', color:'#C9A84C', fontWeight:700 }}>PRIMARY</span>}
                    <span style={{ fontSize:9, padding:'1px 6px', borderRadius:10, background: (CONTEXT_COLOURS as Record<string,string>)[String(acc.context ?? '')]+'20', color: (CONTEXT_COLOURS as Record<string,string>)[String(acc.context ?? '')], fontWeight:600 }}>
                      {(CONTEXT_LABELS as Record<string,string>)[String(acc.context ?? '')] ?? acc.context}
                    </span>
                    {Boolean(acc.label) && acc.label !== acc.email_address && (
                      <span style={{ fontSize:10, color:'var(--pios-muted)' }}>{String(acc.label ?? "")}</span>
                    )}
                  </div>
                  <div style={{ fontSize:10, color:'var(--pios-dim)', marginTop:2 }}>
                    {(PROVIDER_LABELS as Record<string,string>)[String(acc.provider ?? '')]} · {acc.sync_enabled ? 'Sync on' : 'Sync off'}
                    {Boolean(acc.receipt_scan_enabled) && ' · 📄 Receipt scan'}
                    {Boolean(acc.last_synced_at) && ` · Last synced ${new Date(String(acc.last_synced_at ?? "")).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}`}
                    {Boolean(acc.last_sync_error) && <span style={{ color:'#ef4444' }}> · ⚠ {String(acc.last_sync_error ?? "")}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                  {!acc.is_primary && (
                    <button onClick={() => setPrimary(String(acc.id ?? ""))} style={{ fontSize:10, padding:'3px 8px', borderRadius:6, border:'1px solid var(--pios-border)', background:'transparent', cursor:'pointer', color:'var(--pios-muted)' }}>
                      Set primary
                    </button>
                  )}
                  <button onClick={() => toggleReceipts(String(acc.id ?? ""), Boolean(acc.receipt_scan_enabled))} style={{ fontSize:10, padding:'3px 8px', borderRadius:6, border:`1px solid ${acc.receipt_scan_enabled ? 'rgba(34,197,94,0.3)' : 'var(--pios-border)'}`, background: acc.receipt_scan_enabled ? 'rgba(34,197,94,0.08)' : 'transparent', cursor:'pointer', color: acc.receipt_scan_enabled ? '#22c55e' : 'var(--pios-muted)' }}>
                    {acc.receipt_scan_enabled ? '📄 Receipts on' : 'Receipts off'}
                  </button>
                  <button onClick={() => syncAccount(String(acc.id ?? ""))} disabled={syncing === acc.id} style={{ fontSize:10, padding:'3px 8px', borderRadius:6, border:'1px solid var(--pios-border)', background:'transparent', cursor:'pointer', color:'var(--pios-muted)' }}>
                    {syncing === acc.id ? '⟳' : '↻ Sync'}
                  </button>
                  <button onClick={() => disconnect(String(acc.id ?? ""))} style={{ fontSize:10, padding:'3px 8px', borderRadius:6, border:'1px solid rgba(239,68,68,0.2)', background:'transparent', cursor:'pointer', color:'#ef4444' }}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


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


const PERSONAS = [
  { key: 'student',      label: 'Student / Researcher',   desc: 'DBA, MBA, MSc, PhD, CPD',            icon: '🎓' },
  { key: 'professional', label: 'Professional / Consultant', desc: 'Consultant, analyst, specialist', icon: '💼' },
  { key: 'executive',    label: 'Executive / Founder',    desc: 'CEO, MD, C-suite, founder',           icon: '⚡' },
  { key: 'founder',      label: 'Founder',                desc: 'Startup founder / operator',          icon: '🚀' },
  { key: 'individual',   label: 'Individual',             desc: 'Personal use',                        icon: '👤' },
]

function PersonaSection() {
  const [currentPersona, setCurrentPersona] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => {
      setCurrentPersona((d.profile as Record<string,unknown>)?.persona_type as string ?? 'individual')
    }).catch(() => {})
  }, [])

  async function updatePersona(key: string) {
    setSaving(true)
    setCurrentPersona(key)
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_type: key }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* silent */ }
    setSaving(false)
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--pios-text)', marginBottom: 2 }}>Platform Persona</div>
          <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>Controls your dashboard, AI context, and available modules</div>
        </div>
        {saved && <span style={{ fontSize: 12, color: '#22c55e' }}>✓ Saved</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {PERSONAS.map(p => (
          <button key={(p as Record<string,unknown>).key as string} onClick={() => updatePersona(p.key)} disabled={saving}
            style={{
              padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              background: currentPersona === p.key ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${currentPersona === p.key ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
              transition: 'all .15s',
            }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{p.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pios-text)', marginBottom: 2 }}>{p.label}</div>
            <div style={{ fontSize: 11, color: 'var(--pios-muted)', lineHeight: 1.4 }}>{p.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}


type EmailAccount = {
  id: string; email?: string; provider?: string; name?: string
  connected?: boolean; last_synced?: string; display_name?: string
  email_address?: string; is_primary?: boolean; context?: string
  label?: string; sync_enabled?: boolean; last_synced_at?: string
  last_sync_error?: string
  receipt_scan_enabled?: boolean
}

// ProfileRecord defined above

// TenantRecord → TenantSettings above

// UserRecord → ProfileRecord above

// FeedSettings → FeedSettings above


type ProfileRecord = {
  id?: string; full_name?: string; email?: string; avatar_url?: string
  programme_name?: string; university?: string; supervisor?: string
  timezone?: string; job_title?: string; organisation?: string
  research_area?: string; student_id?: string; persona?: string
  cpd_body?: string; start_date?: string; expected_completion?: string
  [key: string]: unknown
}

type TenantSettings = {
  id?: string; name?: string; plan?: string; subscription_status?: string
  billing_email?: string; trial_ends_at?: string; company_name?: string
  logo_url?: string; primary_colour?: string; domain?: string
  [key: string]: unknown
}

type FeedSettings = {
  command_layout?: string; brief_include_feeds?: boolean
  show_relevance?: boolean; brief_time?: string; brief_feed_count?: number
  [key: string]: unknown
}

type ConnectedAccount = {
  id: string; provider: string; email?: string; display_name?: string
  connected?: boolean; scope?: string; last_synced?: string
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileRecord|null>(null)
  const [tenant,  setTenant]  = useState<Record<string,unknown>|null>(null)
  const [user,    setUser]    = useState<Record<string,unknown>|null>(null)
  const [feedSettings,   setFeedSettings]   = useState<Record<string,unknown>|null>(null)
  const [billingNotice,  setBillingNotice]  = useState<{msg:string,ok:boolean}|null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [form, setForm] = useState({ full_name:'', programme_name:'', university:'', timezone:'Europe/London', job_title:'', organisation:'', billing_email:'' })
  useEffect(() => {
    async function load() {
      const [pR, fR] = await Promise.all([
        fetch('/api/profile').then(r => r.ok ? r.json() : {}) as Promise<unknown>,
        fetch('/api/feeds').then(r => r.json()).catch(() => ({ settings: null })),
      ])
      setUser(((pR as Record<string,unknown>).user ?? null) as UserRecord | null)
      setProfile(((pR as Record<string,unknown>).profile ?? null) as ProfileRecord | null)
      setTenant(((pR as Record<string,unknown>).tenant ?? null) as TenantRecord | null)
      setFeedSettings(fR.settings)
      if ((pR as Record<string,unknown>).profile) setForm({
        full_name:      ((pR as Record<string,unknown>).profile as ProfileRecord)?.full_name ?? '',
        billing_email:  ((pR as Record<string,unknown>).profile as ProfileRecord)?.billing_email ?? '',
        programme_name: ((pR as Record<string,unknown>).profile as ProfileRecord)?.programme_name ?? '',
        university:     ((pR as Record<string,unknown>).profile as ProfileRecord)?.university ?? '',
        timezone:       ((pR as Record<string,unknown>).profile as ProfileRecord)?.timezone       ?? 'Europe/London',
        job_title:      ((pR as Record<string,unknown>).profile as ProfileRecord)?.job_title      ?? '',
        organisation:   ((pR as Record<string,unknown>).profile as ProfileRecord)?.organisation   ?? '',
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
    setSaving(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const { profile } = await res.json()
      setProfile(profile)
    }
    setSaving(false); setEditing(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function updateFeedSetting(key: string, value: unknown) {
    const next = { ...(feedSettings??{}), [key]: value }
    setFeedSettings(next)
    await fetch('/api/feeds', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'settings', ...(next as Record<string,unknown>) }) })
  }

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh' }}>
      <div style={{ width:18,height:18,border:'2px solid rgba(167,139,250,0.2)',borderTop:'2px solid #a78bfa',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
    </div>
  )

  const plan = tenant?.plan ?? 'individual'
  const planInfo = ((PLANS as Record<string,unknown>)[String(plan ?? '')] ?? (PLANS as Record<string,unknown>).individual) as Record<string,unknown>
  const creditsUsed: number = Number(tenant?.ai_credits_used ?? 0)
  const creditsLimit: number = Number(tenant?.ai_credits_limit ?? planInfo.credits ?? 0)
  const creditsPct = Math.min(100, (Number(creditsUsed ?? 0) / Number(creditsLimit ?? 1)) * 100)

  return (
    <div className="fade-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:28 }}>
        <h1 style={{ fontSize:22,fontWeight:700 }}>Settings</h1>
        {saved && <span style={{ fontSize:12,color:'#22c55e',padding:'4px 12px',borderRadius:20,background:'rgba(34,197,94,0.1)' }}>✓ Saved</span>}
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>

        <PersonaSection />

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
                  <input className="pios-input" value={String((form as Record<string, unknown>)[k] ?? "")} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} />
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
                ['Name',     String(profile?.full_name ?? user?.email ?? '').split('@')[0] || '—'],
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
        <div id="billing" />
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
          {Boolean(tenant?.stripe_customer_id) && (
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

        {/* Email Accounts — multi-inbox manager */}
        <EmailAccountsSection />

        {/* Other Integrations */}
        <Section title="Other Integrations">
          {[
            { name:'Intelligence Feeds', connected:true, detail:'Configure in Command Centre → Intelligence Feeds', colour:'#22c55e' },
            { name:'Zotero (Research Library)', connected:false, detail:'Add Zotero Key in Research Hub → Import & Connect', colour:'#CC2936' },
            { name:'Stripe (Billing)', connected:!!tenant?.stripe_customer_id, detail:'Managed automatically', colour:'#635BFF' },
          ].map(i => (
            <div key={(i as Record<string,unknown>).name as string} style={{ padding:'10px 0',borderBottom:'1px solid var(--pios-border)' }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:13,fontWeight:500,marginBottom:2 }}>{i.name}</div>
                  <div style={{ fontSize:11,color:'var(--pios-dim)' }}>{i.detail}</div>
                </div>
                <span style={{ fontSize:11,padding:'3px 10px',borderRadius:20,background:i.connected?'rgba(34,197,94,0.1)':'rgba(255,255,255,0.05)',color:i.connected?'#22c55e':'var(--pios-dim)',flexShrink:0,marginLeft:12 }}>
                  {i.connected?'Connected':'Not connected'}
                </span>
              </div>
            </div>
          ))}
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
                <label key={(opt as Record<string,unknown>).key as string} style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:13 }}>
                  <input type="checkbox" checked={!!(feedSettings as Record<string,unknown>)[opt.key]} onChange={e=>updateFeedSetting(opt.key, e.target.checked)} />
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
            ['Owner',           'VeritasIQ Technologies Ltd'],
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
