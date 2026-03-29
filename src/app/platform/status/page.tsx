// @ts-nocheck
'use client'
// PIOS™ v3.7.0 | Sprint O — Platform Status | VeritasIQ Technologies Ltd
import { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, XCircle, Loader2, RefreshCw } from 'lucide-react'

interface ServiceCheck {
  name: string
  status: 'ok' | 'warn' | 'error' | 'checking'
  latency?: number
  note?: string
}

export default function StatusPage() {
  const [checks,    setChecks]    = useState<ServiceCheck[]>([])
  const [loading,   setLoading]   = useState(true)
  const [lastCheck, setLastCheck] = useState<string | null>(null)

  async function runChecks() {
    setLoading(true)
    const start = Date.now()

    const services: ServiceCheck[] = [
      { name:'PIOS API',        status:'checking' },
      { name:'Supabase DB',     status:'checking' },
      { name:'Anthropic AI',    status:'checking' },
      { name:'Stripe Billing',  status:'checking' },
      { name:'RESEND Email',    status:'checking' },
      { name:'CRON Jobs',       status:'checking' },
      { name:'Gmail OAuth',     status:'checking' },
      { name:'VeritasEdge™',   status:'checking' },
      { name:'InvestiScript™', status:'checking' },
    ]
    setChecks(services.map(s => ({...s})))

    // Check PIOS API health
    try {
      const t = Date.now()
      const r = await fetch('/api/health/smoke')
      const d = await r.json()
      updateCheck('PIOS API', r.ok ? 'ok' : 'error', Date.now()-t, d.status ?? (r.ok?'healthy':'unhealthy'))
    } catch { updateCheck('PIOS API', 'error', undefined, 'Request failed') }

    // Check onboarding (hits DB)
    try {
      const t = Date.now()
      const r = await fetch('/api/onboarding')
      const d = await r.json()
      const lat = Date.now()-t
      updateCheck('Supabase DB', r.ok ? 'ok' : 'error', lat, r.ok?'Connected':'Failed')
      // Check env flags from onboarding readiness
      if (d.readiness) {
        updateCheck('Stripe Billing',  d.readiness.stripe_live ? 'ok' : 'warn', undefined, d.readiness.stripe_live ? 'Live keys configured' : 'Needs sk_live_ key in Vercel')
        updateCheck('RESEND Email',    d.readiness.resend      ? 'ok' : 'warn', undefined, d.readiness.resend      ? 'RESEND_API_KEY set'  : 'Add RESEND_API_KEY to Vercel')
        updateCheck('CRON Jobs',       d.readiness.cron        ? 'ok' : 'warn', undefined, d.readiness.cron        ? 'CRON_SECRET set'     : 'Add CRON_SECRET to Vercel — 13 crons configured in vercel.json')
        updateCheck('Gmail OAuth',     d.readiness.nemoclaw    ? 'ok' : 'warn', undefined, 'Check Google OAuth client config')
      }
    } catch { updateCheck('Supabase DB', 'error', undefined, 'Request failed') }

    // Check Anthropic
    try {
      const t = Date.now()
      const r = await fetch('/api/notifications/smart', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'digest', notifications:[]}),
      })
      updateCheck('Anthropic AI', r.ok ? 'ok' : 'error', Date.now()-t, r.ok?'Haiku 4.5 responding':'API error')
    } catch { updateCheck('Anthropic AI', 'warn', undefined, 'Check ANTHROPIC_API_KEY') }

    // Check external platforms (just reachability)
    for (const [name, url] of [
      ['VeritasEdge™',   'https://sustainedge.vercel.app/api/health'],
      ['InvestiScript™', 'https://investiscript.vercel.app/api/health'],
    ]) {
      try {
        const t = Date.now()
        const r = await fetch(url, { mode:'no-cors', signal:AbortSignal.timeout(5000) })
        updateCheck(name, 'ok', Date.now()-t, 'Reachable')
      } catch {
        updateCheck(name, 'warn', undefined, 'Check deployment status')
      }
    }

    setLastCheck(new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit',second:'2-digit'}))
    setLoading(false)
  }

  function updateCheck(name: string, status: ServiceCheck['status'], latency?: number, note?: string) {
    setChecks(prev => prev.map(c => c.name===name ? {...c, status, latency, note} : c))
  }

  useEffect(() => { runChecks() }, [])

  const C = { navy:'#0D2B52', gold:'#C9A84C' }
  const statusIcon = (s: string) => {
    if (s==='ok')       return <CheckCircle2 size={16} color='#22c55e'/>
    if (s==='warn')     return <AlertCircle  size={16} color='#f59e0b'/>
    if (s==='error')    return <XCircle      size={16} color='#ef4444'/>
    return <Loader2 size={16} color='#94a3b8'/>
  }
  const okCount   = checks.filter(c => c.status==='ok').length
  const warnCount = checks.filter(c => c.status==='warn').length
  const errCount  = checks.filter(c => c.status==='error').length
  const overallOk = errCount===0 && !loading

  return (
    <div style={{ fontFamily:'var(--font-sans,system-ui)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:500, color:'var(--color-text-primary)', margin:0 }}>Platform Status</h1>
          <p style={{ fontSize:12, color:'var(--color-text-tertiary)', marginTop:4 }}>
            Live service health · Infrastructure readiness · External platform connectivity
          </p>
        </div>
        <button onClick={runChecks} disabled={loading}
          style={{ borderRadius:8, border:'0.5px solid var(--color-border-secondary)', background:'transparent', color:'var(--color-text-secondary)', padding:'7px 12px', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', gap:5, opacity:loading?0.5:1 }}>
          <RefreshCw size={11}/> Re-check
        </button>
      </div>

      {/* Overall status */}
      <div style={{ background:overallOk ? '#f0fdf4' : warnCount>0 ? '#fffbeb' : '#fef2f2', border:`0.5px solid ${overallOk?'#bbf7d0':warnCount>0?'#fde68a':'#fca5a5'}`, borderRadius:12, padding:'14px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
        {loading ? <Loader2 size={18} color='#94a3b8'/> : overallOk ? <CheckCircle2 size={18} color='#22c55e'/> : <AlertCircle size={18} color='#f59e0b'/>}
        <div>
          <p style={{ fontSize:14, fontWeight:600, color:overallOk?'#15803d':warnCount>0?'#b45309':'#b91c1c', marginBottom:2 }}>
            {loading ? 'Running health checks…' : overallOk ? 'All systems operational' : warnCount > 0 ? `${warnCount} service${warnCount!==1?'s':''} need attention` : 'Service errors detected'}
          </p>
          {lastCheck && <p style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>Last checked: {lastCheck} · {okCount} ok · {warnCount} warnings · {errCount} errors</p>}
        </div>
      </div>

      {/* Service grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
        {checks.map(svc => (
          <div key={svc.name} style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
            {statusIcon(svc.status)}
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                <span style={{ fontSize:13, fontWeight:500, color:'var(--color-text-primary)' }}>{svc.name}</span>
                {svc.latency && <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>{svc.latency}ms</span>}
              </div>
              {svc.note && <p style={{ fontSize:11, color:'var(--color-text-tertiary)', lineHeight:1.4 }}>{svc.note}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Pending actions */}
      {warnCount > 0 && (
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:12, padding:'16px 18px' }}>
          <p style={{ fontSize:12, fontWeight:500, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Pending configuration</p>
          {[
            { label:'CRON_SECRET',         note:'Add to Vercel env vars — activates 13 scheduled cron jobs',       urgent:true  },
            { label:'STRIPE_SECRET_KEY',   note:'Add sk_live_ key to Vercel — activates billing',                  urgent:true  },
            { label:'RESEND_API_KEY',      note:'Add to Vercel env vars — activates transactional email',           urgent:false },
            { label:'STRIPE_WEBHOOK_SECRET',note:'Configure Stripe dashboard → Webhooks → copy signing secret',   urgent:false },
            { label:'Gmail OAuth',         note:'Connect at /platform/settings — enables calendar + email sync',   urgent:false },
          ].map(item => (
            <div key={item.label} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'6px 0', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
              <span style={{ fontSize:10, padding:'2px 6px', borderRadius:6, fontWeight:600, background:item.urgent?'#fef2f2':'#fffbeb', color:item.urgent?'#b91c1c':'#b45309', flexShrink:0, marginTop:1 }}>{item.urgent?'URGENT':'INFO'}</span>
              <div>
                <code style={{ fontSize:12, fontFamily:'var(--font-mono,monospace)', color:'var(--color-text-primary)' }}>{item.label}</code>
                <p style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:2 }}>{item.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
