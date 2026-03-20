import { createClient } from '@/lib/supabase/server'
import { PLANS } from '@/lib/stripe/client'
import Link from 'next/link'
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id',user.id).single()
  const { data: tenant } = await supabase.from('tenants').select('*').single()

  return (
    <div className="fade-in">
      <h1 style={{ fontSize:'22px', fontWeight:700, marginBottom:'28px' }}>Settings</h1>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
        {/* Profile */}
        <div className="pios-card">
          <div style={{ fontSize:'14px', fontWeight:600, marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid var(--pios-border)' }}>Profile</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {[
              { label:'Name', value:profile?.full_name||user.email?.split('@')[0] },
              { label:'Email', value:user.email },
              { label:'Programme', value:profile?.programme_name||'Not set' },
              { label:'University', value:profile?.university||'Not set' },
              { label:'Timezone', value:profile?.timezone||'Europe/London' },
            ].map(f=>(
              <div key={f.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'12px', color:'var(--pios-muted)' }}>{f.label}</span>
                <span style={{ fontSize:'13px' }}>{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan */}
        <div className="pios-card">
          <div style={{ fontSize:'14px', fontWeight:600, marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid var(--pios-border)' }}>Plan & Billing</div>
          <div style={{ marginBottom:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
              <span style={{ fontSize:'20px', fontWeight:700, color:'var(--ai)' }}>{tenant?.plan?.charAt(0).toUpperCase()+tenant?.plan?.slice(1)||'Individual'}</span>
              <span style={{ fontSize:'12px', padding:'2px 8px', borderRadius:'20px', background:'rgba(167,139,250,0.1)', color:'var(--ai)' }}>
                {tenant?.subscription_status||'active'}
              </span>
            </div>
            <div style={{ height:'6px', background:'var(--pios-surface2)', borderRadius:'3px', marginBottom:'6px' }}>
              <div style={{ height:'100%', width:`${Math.min(100,((tenant?.ai_credits_used||0)/(tenant?.ai_credits_limit||5000))*100)}%`, background:'var(--ai)', borderRadius:'3px' }} />
            </div>
            <div style={{ fontSize:'11px', color:'var(--pios-dim)' }}>{(tenant?.ai_credits_used||0).toLocaleString()} / {(tenant?.ai_credits_limit||5000).toLocaleString()} AI credits used</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {Object.entries(PLANS).map(([key, plan]) => (
              <div key={key} style={{ padding:'10px', borderRadius:'8px', background:tenant?.plan===key?'rgba(167,139,250,0.1)':'var(--pios-surface2)', border:`1px solid ${tenant?.plan===key?'rgba(167,139,250,0.3)':'transparent'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'13px', fontWeight:600 }}>{plan.name}</span>
                  <span style={{ fontSize:'13px', color:tenant?.plan===key?'var(--ai)':'var(--pios-muted)' }}>${plan.price}/mo</span>
                </div>
                {tenant?.plan!==key && (
                  <Link href={`/api/stripe/checkout?plan=${key}`} style={{ fontSize:'11px', color:'var(--ai)', textDecoration:'none' }}>Upgrade →</Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <div className="pios-card">
          <div style={{ fontSize:'14px', fontWeight:600, marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid var(--pios-border)' }}>Integrations</div>
          {[
            { name:'Google (Gmail + Calendar)', connected:!!profile?.google_email, detail:profile?.google_email, colour:'#4285F4' },
            { name:'Zotero (Research Library)', connected:false, detail:'Connect to sync literature', colour:'#CC2936' },
            { name:'Stripe (Billing)', connected:!!tenant?.stripe_customer_id, detail:'Managed automatically', colour:'#635BFF' },
          ].map(i=>(
            <div key={i.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--pios-border)' }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:500 }}>{i.name}</div>
                <div style={{ fontSize:'11px', color:'var(--pios-dim)' }}>{i.detail}</div>
              </div>
              <span style={{ fontSize:'11px', padding:'3px 10px', borderRadius:'20px', background:i.connected?'rgba(34,197,94,0.1)':'rgba(255,255,255,0.05)', color:i.connected?'#22c55e':'var(--pios-dim)' }}>
                {i.connected?'Connected':'Not connected'}
              </span>
            </div>
          ))}
        </div>

        {/* Versions */}
        <div className="pios-card">
          <div style={{ fontSize:'14px', fontWeight:600, marginBottom:'16px', paddingBottom:'12px', borderBottom:'1px solid var(--pios-border)' }}>System</div>
          {[
            { label:'PIOS Version', value:'v1.0.0' },
            { label:'AI Engine', value:'claude-sonnet-4-20250514' },
            { label:'Database', value:'Supabase PostgreSQL' },
            { label:'Deployment', value:'Vercel (pios.vercel.app)' },
            { label:'Owner', value:'Sustain International FZE Ltd' },
          ].map(f=>(
            <div key={f.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--pios-border)' }}>
              <span style={{ fontSize:'12px', color:'var(--pios-muted)' }}>{f.label}</span>
              <span style={{ fontSize:'12px', fontFamily:'monospace', color:'var(--pios-text)' }}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
