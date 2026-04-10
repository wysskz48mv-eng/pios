// @ts-nocheck
'use client'
// PIOS™ v3.6.0 | Sprint M — Billing Page v4 | VeritasIQ Technologies Ltd
import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, CreditCard } from 'lucide-react'

const PLAN_COL = { student:'#60a5fa', professional:'#a78bfa', executive:'#C9A84C', enterprise:'#4ade80' }
const STATUS_STYLE = {
  active:    { bg:'#f0fdf4', text:'#15803d', label:'Active'    },
  trialing:  { bg:'#eff6ff', text:'#1d4ed8', label:'Trial'     },
  inactive:  { bg:'#f8fafc', text:'#64748b', label:'Inactive'  },
  past_due:  { bg:'#fef2f2', text:'#b91c1c', label:'Past due'  },
  cancelled: { bg:'#fef2f2', text:'#b91c1c', label:'Cancelled' },
}

const PLANS = [
  { id:'student',      name:'Student',      price:9,   credits:2000,   features:['Academic Hub','CPD Tracker','Supervisor logs','2,000 AI credits/mo'] },
  { id:'professional', name:'Professional', price:29,  credits:10000,  features:['All Student','Professional workspace','NemoClaw™ AI','10,000 AI credits/mo','Viva prep module'] },
  { id:'executive',    name:'Executive',    price:79,  credits:50000,  features:['All Professional','Chief of Staff daily brief','Knowledge graph','Background agents','50,000 AI credits/mo'] },
  { id:'enterprise',   name:'Enterprise',   price:199, credits:200000, features:['All Executive','Custom AI model routing','White-glove onboarding','SLA','200,000 AI credits/mo'] },
]

export default function BillingPage() {
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [portalLoad, setPortalLoad] = useState(false)
  const [checkLoad,  setCheckLoad]  = useState('')

  useEffect(() => {
    fetch('/api/billing').then(r=>r.json()).then(d => {
      setData(d.ok ? d : null); setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function goPortal() {
    setPortalLoad(true)
    try {
      const r = await fetch('/api/stripe/portal')
      const d = await r.json()
      if (d.url) window.location.href = d.url
      else alert(d.error || 'Portal unavailable — configure Stripe live keys first')
    } catch (err) { console.error('[PIOS]', err) }
    setPortalLoad(false)
  }

  async function startCheckout(planId) {
    setCheckLoad(planId)
    try {
      const r = await fetch('/api/stripe/checkout?plan=' + planId)
      const d = await r.json()
      if (d.url) window.location.href = d.url
      else alert(d.error || 'Checkout unavailable — configure Stripe live keys first')
    } catch (err) { console.error('[PIOS]', err) }
    setCheckLoad('')
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'3rem',color:'var(--color-text-tertiary)',fontSize:13}}>
      <Loader2 size={16}/> Loading billing state…
    </div>
  )

  const C = { navy:'#0D2B52', gold:'#C9A84C', teal:'#0A7A7A' }
  const card = { background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:12, padding:'16px 18px', marginBottom:12 }
  const planCol  = data?.plan ? (PLAN_COL[data.plan.id] || C.gold) : C.gold
  const subStyle = data?.billing?.status ? (STATUS_STYLE[data.billing.status] || STATUS_STYLE.inactive) : STATUS_STYLE.inactive

  return (
    <div style={{fontFamily:'var(--font-sans,system-ui)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:20}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:500,color:'var(--color-text-primary)',margin:0,display:'flex',alignItems:'center',gap:8}}>
            <CreditCard size={18} color={C.gold}/> Billing
          </h1>
          <p style={{fontSize:12,color:'var(--color-text-tertiary)',marginTop:4}}>Subscription · usage · infrastructure readiness</p>
        </div>
        {data?.billing?.status === 'active' && (
          <button onClick={goPortal} disabled={portalLoad}
            style={{borderRadius:8,border:'none',background:C.navy,color:'#fff',padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:6,opacity:portalLoad?0.5:1}}>
            {portalLoad?<Loader2 size={12}/>:<ExternalLink size={12}/>} Manage subscription
          </button>
        )}
      </div>

      {/* Current plan + status */}
      {data && (
        <div style={{...card,borderLeft:`3px solid ${planCol}`,marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <span style={{fontSize:20,fontWeight:700,color:planCol}}>{data.plan?.name ?? 'Professional'}</span>
                <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:600,background:subStyle.bg,color:subStyle.text}}>{subStyle.label}</span>
              </div>
              <p style={{fontSize:14,color:'var(--color-text-secondary)'}}>£{data.plan?.price ?? 29}/month · {(data.plan?.credits ?? 10000).toLocaleString()} AI credits</p>
              {data.billing?.billing_email && <p style={{fontSize:11,color:'var(--color-text-tertiary)',marginTop:4}}>{data.billing.billing_email}</p>}
              {data.billing?.trial_ends_at && (
                <p style={{fontSize:12,color:'#f59e0b',marginTop:4}}>
                  Trial ends: {new Date(data.billing.trial_ends_at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
                </p>
              )}
            </div>
            {/* Usage donut-style bar */}
            {data.usage && (
              <div style={{textAlign:'center',minWidth:120}}>
                <p style={{fontSize:11,color:'var(--color-text-tertiary)',marginBottom:6}}>AI credits this month</p>
                <div style={{height:8,background:'var(--color-border-tertiary)',borderRadius:4,overflow:'hidden',marginBottom:4}}>
                  <div style={{height:'100%',width:`${Math.min(100,data.usage.credits_pct)}%`,background:data.usage.credits_pct>80?'#ef4444':data.usage.credits_pct>60?'#f59e0b':C.teal,borderRadius:4}}/>
                </div>
                <p style={{fontSize:12,fontWeight:500,color:'var(--color-text-primary)'}}>{data.usage.credits_used.toLocaleString()} / {data.usage.credits_limit.toLocaleString()}</p>
                <p style={{fontSize:10,color:'var(--color-text-tertiary)'}}>{data.usage.credits_pct}% used · {data.usage.calls_this_month} calls</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Infrastructure readiness */}
      {data?.readiness && (
        <div style={{...card,marginBottom:16}}>
          <p style={{fontSize:11,fontWeight:500,color:'var(--color-text-tertiary)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Infrastructure readiness</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {[
              {label:'Stripe live keys',    ok:data.readiness.stripe_live,  action:'Add STRIPE_SECRET_KEY (sk_live_…) to Vercel'},
              {label:'Stripe customer',     ok:data.readiness.has_customer, action:'Customer created on first checkout'},
              {label:'Active subscription', ok:data.readiness.has_sub,     action:'Subscribe to activate'},
              {label:'RESEND email',        ok:data.readiness.resend,      action:'Add RESEND_API_KEY to Vercel'},
              {label:'CRON scheduled',      ok:data.readiness.cron,        action:'Add CRON_SECRET to Vercel + configure vercel.json'},
              {label:'NemoClaw™ calibrated',ok:data.readiness.nemoclaw,   action:'Upload CV in Onboarding'},
            ].map(item=>(
              <div key={item.label} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'10px 12px',borderRadius:8,background:'var(--color-background-secondary)'}}>
                {item.ok ? <CheckCircle2 size={14} color='#22c55e' style={{flexShrink:0,marginTop:1}}/> : <AlertCircle size={14} color='#f59e0b' style={{flexShrink:0,marginTop:1}}/>}
                <div>
                  <p style={{fontSize:12,fontWeight:500,color:'var(--color-text-primary)',marginBottom:2}}>{item.label}</p>
                  {!item.ok && <p style={{fontSize:10,color:'var(--color-text-tertiary)',lineHeight:1.4}}>{item.action}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan upgrade cards */}
      <p style={{fontSize:12,fontWeight:500,color:'var(--color-text-tertiary)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Plans</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:16}}>
        {PLANS.map(plan=>{
          const isCurrent = data?.plan?.id === plan.id
          const col = PLAN_COL[plan.id] || C.gold
          return (
            <div key={plan.id} style={{...card,borderTop:`3px solid ${col}`,opacity:isCurrent?1:0.85}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                <div>
                  <p style={{fontSize:14,fontWeight:600,color:col,marginBottom:2}}>{plan.name}</p>
                  <p style={{fontSize:18,fontWeight:700,color:'var(--color-text-primary)'}}>£{plan.price}<span style={{fontSize:11,fontWeight:400,color:'var(--color-text-tertiary)'}}>/mo</span></p>
                </div>
                {isCurrent ? (
                  <span style={{fontSize:10,padding:'3px 10px',borderRadius:20,background:`${col}20`,color:col,fontWeight:600}}>Current plan</span>
                ) : (
                  <button onClick={()=>startCheckout(plan.id)} disabled={checkLoad===plan.id}
                    style={{borderRadius:8,border:'none',background:col,color:'#fff',padding:'6px 14px',cursor:'pointer',fontSize:12,fontWeight:600,opacity:checkLoad===plan.id?0.5:1,display:'flex',alignItems:'center',gap:4}}>
                    {checkLoad===plan.id?<Loader2 size={11}/>:null} Upgrade
                  </button>
                )}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                {plan.features.map((f,i)=>(
                  <div key={i} style={{fontSize:11,color:'var(--color-text-secondary)',display:'flex',alignItems:'center',gap:6}}>
                    <span style={{color:col,fontSize:10}}>✓</span> {f}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pending actions */}
      {data && !data.readiness?.stripe_live && (
        <div style={{...card,borderLeft:'3px solid #f59e0b',background:'#fffbeb08'}}>
          <p style={{fontSize:13,fontWeight:500,color:'#b45309',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
            <AlertCircle size={13}/> Pending: activate Stripe live billing
          </p>
          <div style={{fontSize:12,color:'var(--color-text-secondary)',lineHeight:2}}>
            <div>1. Add <code style={{background:'var(--color-background-secondary)',padding:'1px 6px',borderRadius:4,fontFamily:'var(--font-mono,monospace)'}}>STRIPE_SECRET_KEY</code> (sk_live_…) to Vercel environment variables</div>
            <div>2. Add <code style={{background:'var(--color-background-secondary)',padding:'1px 6px',borderRadius:4,fontFamily:'var(--font-mono,monospace)'}}>STRIPE_WEBHOOK_SECRET</code> for subscription event handling</div>
            <div>3. Set Stripe price IDs: <code style={{background:'var(--color-background-secondary)',padding:'1px 6px',borderRadius:4,fontFamily:'var(--font-mono,monospace)'}}>STRIPE_PROFESSIONAL_PRICE_ID</code>, etc.</div>
            <div>4. Redeploy Vercel to pick up new env vars</div>
          </div>
        </div>
      )}
    </div>
  )
}
