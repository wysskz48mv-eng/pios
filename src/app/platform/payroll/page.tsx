'use client'
import { useEffect, useState, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Payroll & Finance Workflows
// Staff management · Payroll runs · Remittances · Transfer queue · Expense claims · Chase
// ALL financial actions are HITL — nothing executes without explicit approval
// ─────────────────────────────────────────────────────────────────────────────

const TABS = ['runs', 'transfers', 'claims', 'staff', 'chase'] as const
type Tab = typeof TABS[number]

const RUN_STATUS: Record<string, string> = {
  draft:'#6c8eff', approved:'#f59e0b', remittance_sent:'#22c55e',
  paid:'#2dd4a0', cancelled:'#64748b',
}
const TRF_STATUS: Record<string, string> = {
  queued:'#6c8eff', approved:'#f59e0b', completed:'#22c55e',
  failed:'#ef4444', cancelled:'#64748b',
}
const CLM_STATUS: Record<string, string> = {
  submitted:'#6c8eff', queued_for_payment:'#f59e0b', paid:'#22c55e',
  rejected:'#ef4444', draft:'#64748b',
}

function Badge({ label, colour }: { label: string; colour: string }) {
  return <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:colour+'20', color:colour, fontWeight:600, whiteSpace:'nowrap' as const }}>{label.replace(/_/g,' ')}</span>
}
function TabBtn({ active, onClick, children }: { active:boolean; onClick:()=>void; children:React.ReactNode }) {
  return <button onClick={onClick} style={{ padding:'8px 16px', fontSize:13, fontWeight:active?600:400, border:'none', borderBottom:`2px solid ${active?'#a78bfa':'transparent'}`, background:'none', cursor:'pointer', color:active?'#a78bfa':'var(--pios-muted)', marginBottom:-1, transition:'all 0.15s' }}>{children}</button>
}
function Spinner() {
  return <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--pios-muted)', fontSize:13, padding:'32px 0', justifyContent:'center' }}>
    <div style={{ width:14, height:14, border:'2px solid rgba(167,139,250,0.2)', borderTop:'2px solid #a78bfa', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />Loading…
  </div>
}

const HITL_BANNER = (
  <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(239,68,68,0.08)', borderLeft:'3px solid #ef4444', fontSize:12, color:'var(--pios-text)', marginBottom:16 }}>
    <strong style={{ color:'#ef4444' }}>⚠ HITL Gate — All financial actions require your explicit approval.</strong> No bank transfer, remittance, or payment will execute without you clicking Approve.
  </div>
)

// ── Payroll runs tab ──────────────────────────────────────────────────────────
function RunsTab() {
  const [runs, setRuns]           = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [detectResult, setDetectResult] = useState<any>(null)
  const [selectedRun, setSelectedRun]   = useState<any>(null)
  const [lines, setLines]         = useState<any[]>([])
  const [linesLoading, setLinesLoading] = useState(false)
  const [remitting, setRemitting] = useState(false)
  const [remitPreview, setRemitPreview] = useState<any>(null)

  const loadRuns = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/payroll?type=runs')
    const d = await res.json()
    setRuns(d.runs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadRuns() }, [loadRuns])

  async function selectRun(run: any) {
    setSelectedRun(run); setLinesLoading(true); setRemitPreview(null)
    const res = await fetch(`/api/payroll?type=lines&run_id=${run.id}`)
    const d = await res.json()
    setLines(d.lines ?? []); setLinesLoading(false)
  }

  async function detect() {
    setDetecting(true); setDetectResult(null)
    const res = await fetch('/api/payroll/detect', { method: 'POST' })
    const d = await res.json()
    setDetectResult(d); setDetecting(false)
    if (d.detected) loadRuns()
  }

  async function approveRun(runId: string) {
    await fetch('/api/payroll', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'approve_run', run_id:runId }) })
    loadRuns(); if (selectedRun?.id === runId) setSelectedRun((p: any) => p ? {...p, status:'approved'} : p)
  }

  async function previewRemit() {
    if (!selectedRun) return
    setRemitting(true)
    const res = await fetch('/api/payroll/remit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ run_id: selectedRun.id, preview_only: true }) })
    const d = await res.json()
    setRemitPreview(d); setRemitting(false)
  }

  async function confirmRemit() {
    if (!selectedRun) return
    setRemitting(true)
    const res = await fetch('/api/payroll/remit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ run_id: selectedRun.id, preview_only: false }) })
    const d = await res.json()
    if (d.success) { alert(`✓ ${d.remittances_queued} remittances queued for approval in Transfer Queue.`); setRemitPreview(null); loadRuns() }
    else alert(d.error ?? 'Failed')
    setRemitting(false)
  }

  return (
    <div>
      {HITL_BANNER}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontSize:13, color:'var(--pios-muted)' }}>{runs.length} payroll runs</div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="pios-btn pios-btn-ghost" onClick={detect} disabled={detecting} style={{ fontSize:12 }}>
            {detecting ? '⟳ Scanning…' : '📧 Detect from Gmail'}
          </button>
        </div>
      </div>

      {detectResult && (
        <div style={{ padding:'12px 16px', borderRadius:8, background: detectResult.detected?'rgba(34,197,94,0.08)':'rgba(108,142,255,0.08)', borderLeft:`3px solid ${detectResult.detected?'#22c55e':'#6c8eff'}`, marginBottom:16, fontSize:13 }}>
          {detectResult.detected
            ? <>✓ <strong>{detectResult.message}</strong></>
            : detectResult.message}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:selectedRun?'1fr 1fr':'1fr', gap:16 }}>
        {/* Run list */}
        <div>
          {loading ? <Spinner /> : runs.length===0 ? (
            <div className="pios-card" style={{ textAlign:'center' as const, padding:'40px' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>💳</div>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>No payroll runs yet</div>
              <p style={{ fontSize:13, color:'var(--pios-muted)', marginBottom:16 }}>Click "Detect from Gmail" to scan for payroll emails from your accountant.</p>
              <button className="pios-btn pios-btn-primary" onClick={detect} disabled={detecting} style={{ fontSize:13 }}>{detecting?'Scanning…':'Detect from Gmail'}</button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
              {runs.map(run => (
                <div key={run.id} onClick={()=>selectRun(run)} className="pios-card" style={{ padding:'14px 16px', cursor:'pointer', border:`1px solid ${selectedRun?.id===run.id?'rgba(167,139,250,0.4)':'var(--pios-border)'}`, background:selectedRun?.id===run.id?'rgba(167,139,250,0.05)':'var(--pios-surface)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, marginBottom:3 }}>{run.pay_period ?? 'Payroll Run'}</div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <Badge label={run.status} colour={RUN_STATUS[run.status]??'#64748b'} />
                        {run.company_entity && <span style={{ fontSize:11, color:'var(--pios-dim)' }}>{run.company_entity}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' as const }}>
                      <div style={{ fontSize:16, fontWeight:800, color:'var(--pios-text)' }}>{run.currency} {parseFloat(run.total_net??0).toFixed(2)}</div>
                      <div style={{ fontSize:11, color:'var(--pios-dim)' }}>net · {run.payroll_lines?.length??0} staff</div>
                    </div>
                  </div>
                  {run.status === 'draft' && (
                    <div style={{ marginTop:10 }}>
                      <button onClick={e=>{e.stopPropagation();approveRun(run.id)}} style={{ fontSize:11, padding:'5px 12px', borderRadius:6, border:'1px solid #22c55e40', background:'none', cursor:'pointer', color:'#22c55e' }}>
                        ✓ Approve run
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Run detail */}
        {selectedRun && (
          <div>
            <div className="pios-card" style={{ borderLeft:'3px solid #a78bfa' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, marginBottom:3 }}>{selectedRun.pay_period}</div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <Badge label={selectedRun.status} colour={RUN_STATUS[selectedRun.status]??'#64748b'} />
                    {selectedRun.pay_date && <span style={{ fontSize:11, color:'var(--pios-dim)' }}>Pay date: {selectedRun.pay_date}</span>}
                  </div>
                </div>
                <button onClick={()=>{setSelectedRun(null);setRemitPreview(null)}} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--pios-muted)', fontSize:16 }}>✕</button>
              </div>

              {/* Pay lines */}
              {linesLoading ? <Spinner /> : lines.length>0 && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--pios-muted)', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:8 }}>Pay lines</div>
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
                    {lines.map(l => (
                      <div key={l.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 10px', borderRadius:6, background:'var(--pios-surface2)', alignItems:'center' }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600 }}>{l.staff_name}</div>
                          {l.staff_email && <div style={{ fontSize:11, color:'var(--pios-dim)' }}>{l.staff_email}</div>}
                        </div>
                        <div style={{ textAlign:'right' as const }}>
                          <div style={{ fontSize:13, fontWeight:700 }}>{selectedRun.currency} {parseFloat(l.net_pay??0).toFixed(2)}</div>
                          <div style={{ fontSize:10, color:'var(--pios-dim)' }}>Gross {parseFloat(l.gross_pay??0).toFixed(2)}</div>
                        </div>
                        {l.remittance_sent && <span style={{ fontSize:10, color:'#22c55e', marginLeft:8 }}>✓ Notified</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remittance actions */}
              {selectedRun.status === 'approved' && !selectedRun.remittance_sent_at && (
                <div>
                  {!remitPreview ? (
                    <button className="pios-btn pios-btn-primary" onClick={previewRemit} disabled={remitting} style={{ width:'100%', fontSize:12 }}>
                      {remitting ? '⟳ Generating…' : '📨 Preview remittances'}
                    </button>
                  ) : (
                    <div>
                      <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(167,139,250,0.08)', marginBottom:10, fontSize:12 }}>
                        <strong>{remitPreview.remittances?.length} remittance drafts ready.</strong> Review the notifications below, then confirm to queue all transfers.
                      </div>
                      {remitPreview.remittances?.slice(0,2).map((r: any, i: number) => (
                        <div key={i} style={{ padding:'10px', borderRadius:6, background:'var(--pios-surface2)', marginBottom:8, fontSize:11 }}>
                          <div style={{ fontWeight:600, marginBottom:4 }}>To: {r.staff_name}</div>
                          <div style={{ color:'var(--pios-muted)', lineHeight:1.5 }}>{r.notification.body?.slice(0,200)}…</div>
                        </div>
                      ))}
                      <div style={{ display:'flex', gap:8, marginTop:10 }}>
                        <button className="pios-btn pios-btn-primary" onClick={confirmRemit} disabled={remitting} style={{ flex:1, fontSize:12 }}>
                          {remitting ? '⟳ Queueing…' : '✓ Queue all transfers'}
                        </button>
                        <button className="pios-btn pios-btn-ghost" onClick={()=>setRemitPreview(null)} style={{ fontSize:12 }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Transfer queue tab ────────────────────────────────────────────────────────
function TransfersTab() {
  const [transfers, setTransfers] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('queued')
  const [actioning, setActioning] = useState<string|null>(null)

  const load = useCallback((f=filter) => {
    setLoading(true)
    fetch(`/api/payroll?type=transfers&status=${f}`).then(r=>r.json()).then(d=>{ setTransfers(d.transfers??[]); setLoading(false) })
  }, [filter])

  useEffect(() => { load() }, [load])

  async function approve(id: string) {
    setActioning(id)
    await fetch('/api/payroll', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'approve_transfer', transfer_id:id }) })
    setActioning(null); load()
  }

  async function complete(id: string) {
    const ref = prompt('Enter bank transfer reference (optional):') ?? ''
    setActioning(id)
    await fetch('/api/payroll', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'complete_transfer', transfer_id:id, reference:ref }) })
    setActioning(null); load()
  }

  const totalQueued = transfers.filter(t=>t.status==='queued').reduce((s,t)=>s+(parseFloat(t.amount)||0),0)
  const totalApproved = transfers.filter(t=>t.status==='approved').reduce((s,t)=>s+(parseFloat(t.amount)||0),0)

  return (
    <div>
      {HITL_BANNER}
      {transfers.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
          {[
            { label:'Awaiting approval', value:`${transfers.filter(t=>t.status==='queued').length} · ${transfers[0]?.currency??'GBP'} ${totalQueued.toFixed(2)}`, colour:'#6c8eff' },
            { label:'Approved — ready', value:`${transfers.filter(t=>t.status==='approved').length} · ${transfers[0]?.currency??'GBP'} ${totalApproved.toFixed(2)}`, colour:'#f59e0b' },
            { label:'Completed', value:transfers.filter(t=>t.status==='completed').length, colour:'#22c55e' },
          ].map(s=>(
            <div key={s.label} className="pios-card-sm" style={{ padding:'12px 14px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:s.colour, marginBottom:3 }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--pios-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' as const }}>
        {[['queued','Queued'],['approved','Approved'],['completed','Completed'],['all','All']].map(([v,l])=>(
          <button key={v} onClick={()=>{ setFilter(v); load(v) }} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, border:'1px solid var(--pios-border)', background:filter===v?'var(--pios-surface)':'transparent', color:filter===v?'var(--pios-text)':'var(--pios-muted)', fontWeight:filter===v?600:400, cursor:'pointer' }}>{l}</button>
        ))}
      </div>

      {loading ? <Spinner /> : transfers.length===0 ? (
        <div className="pios-card" style={{ textAlign:'center' as const, padding:'40px' }}>
          <div style={{ fontSize:13, color:'var(--pios-muted)' }}>No transfers in this queue.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
          {transfers.map(t => (
            <div key={t.id} className="pios-card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:3, flexWrap:'wrap' as const }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{t.recipient_name}</span>
                  <Badge label={t.status} colour={TRF_STATUS[t.status]??'#64748b'} />
                  <Badge label={t.transfer_type?.replace('_',' ')??'payment'} colour="#64748b" />
                </div>
                <div style={{ fontSize:11, color:'var(--pios-dim)', display:'flex', gap:10 }}>
                  {t.recipient_email && <span>{t.recipient_email}</span>}
                  <span>{t.reference}</span>
                  {t.transfer_reference && <span style={{ color:'#22c55e' }}>Ref: {t.transfer_reference}</span>}
                </div>
              </div>
              <div style={{ textAlign:'right' as const, flexShrink:0 }}>
                <div style={{ fontSize:16, fontWeight:800 }}>{t.currency} {parseFloat(t.amount).toFixed(2)}</div>
                {t.status === 'queued' && (
                  <button onClick={()=>approve(t.id)} disabled={actioning===t.id} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #22c55e40', background:'none', cursor:'pointer', color:'#22c55e', marginTop:4 }}>
                    {actioning===t.id?'…':'✓ Approve'}
                  </button>
                )}
                {t.status === 'approved' && (
                  <button onClick={()=>complete(t.id)} disabled={actioning===t.id} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #f59e0b40', background:'none', cursor:'pointer', color:'#f59e0b', marginTop:4 }}>
                    {actioning===t.id?'…':'Mark transferred'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Expense claims tab ────────────────────────────────────────────────────────
function ClaimsTab() {
  const [claims, setClaims]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('submitted')
  const [actioning, setActioning] = useState<string|null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ claimant_name:'', claimant_email:'', amount:'', currency:'GBP', description:'', claim_period:'', category:'' })
  const [saving, setSaving]   = useState(false)

  const load = useCallback((f=filter) => {
    setLoading(true)
    fetch('/api/payroll?type=claims').then(r=>r.json()).then(d=>{
      const filtered = f === 'all' ? (d.claims??[]) : (d.claims??[]).filter((c:any) => c.status === f)
      setClaims(filtered); setLoading(false)
    })
  }, [filter])

  useEffect(() => { load() }, [load])

  async function approve(id: string) {
    setActioning(id)
    await fetch('/api/payroll', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'approve_claim', claim_id:id }) })
    setActioning(null); load()
  }

  async function reject(id: string) {
    const reason = prompt('Rejection reason:')
    if (!reason) return
    await fetch('/api/payroll', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'reject_claim', claim_id:id, reason }) })
    load()
  }

  async function submitClaim() {
    if (!form.claimant_name.trim() || !form.amount) return
    setSaving(true)
    await fetch('/api/payroll', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'submit_claim', claim: { ...form, amount:parseFloat(form.amount) } }) })
    setForm({ claimant_name:'', claimant_email:'', amount:'', currency:'GBP', description:'', claim_period:'', category:'' })
    setShowAdd(false); setSaving(false); load('submitted')
  }

  return (
    <div>
      {HITL_BANNER}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
          {[['submitted','Submitted'],['queued_for_payment','Queued'],['paid','Paid'],['rejected','Rejected'],['all','All']].map(([v,l])=>(
            <button key={v} onClick={()=>{ setFilter(v); load(v) }} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, border:'1px solid var(--pios-border)', background:filter===v?'var(--pios-surface)':'transparent', color:filter===v?'var(--pios-text)':'var(--pios-muted)', fontWeight:filter===v?600:400, cursor:'pointer' }}>{l}</button>
          ))}
        </div>
        <button className="pios-btn pios-btn-primary" onClick={()=>setShowAdd(!showAdd)} style={{ fontSize:12 }}>+ Submit claim</button>
      </div>

      {showAdd && (
        <div className="pios-card" style={{ marginBottom:16, borderColor:'rgba(167,139,250,0.3)' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:10, color:'#a78bfa' }}>Submit Expense Claim</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <input className="pios-input" placeholder="Claimant name *" value={form.claimant_name} onChange={e=>setForm(p=>({...p,claimant_name:e.target.value}))} />
            <input className="pios-input" placeholder="Email" value={form.claimant_email} onChange={e=>setForm(p=>({...p,claimant_email:e.target.value}))} />
            <input className="pios-input" placeholder="Amount *" type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} />
            <div style={{ display:'flex', gap:6 }}>
              <select className="pios-input" style={{ width:'auto' }} value={form.currency} onChange={e=>setForm(p=>({...p,currency:e.target.value}))}>
                {['GBP','USD','SAR','AED','EUR'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <input className="pios-input" placeholder="Claim period (e.g. March 2026)" value={form.claim_period} onChange={e=>setForm(p=>({...p,claim_period:e.target.value}))} />
            </div>
          </div>
          <input className="pios-input" placeholder="Category (travel / software / equipment…)" value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={{ marginBottom:8 }} />
          <input className="pios-input" placeholder="Description" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} style={{ marginBottom:10 }} />
          <div style={{ display:'flex', gap:8 }}>
            <button className="pios-btn pios-btn-primary" onClick={submitClaim} disabled={saving} style={{ fontSize:12 }}>{saving?'Submitting…':'Submit claim'}</button>
            <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAdd(false)} style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : claims.length===0 ? (
        <div className="pios-card" style={{ textAlign:'center' as const, padding:'40px' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🧾</div>
          <div style={{ fontSize:13, color:'var(--pios-muted)' }}>No expense claims in this view.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
          {claims.map(c => (
            <div key={c.id} className="pios-card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:3, flexWrap:'wrap' as const }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{c.claimant_name}</span>
                  <Badge label={c.status} colour={CLM_STATUS[c.status]??'#64748b'} />
                  {c.category && <span style={{ fontSize:11, color:'var(--pios-dim)' }}>{c.category}</span>}
                </div>
                <div style={{ fontSize:12, color:'var(--pios-muted)' }}>{c.description}</div>
                {c.claim_period && <div style={{ fontSize:11, color:'var(--pios-dim)' }}>{c.claim_period}</div>}
                {c.rejection_reason && <div style={{ fontSize:11, color:'#ef4444' }}>Rejected: {c.rejection_reason}</div>}
              </div>
              <div style={{ textAlign:'right' as const, flexShrink:0 }}>
                <div style={{ fontSize:16, fontWeight:800 }}>{c.currency} {parseFloat(c.amount).toFixed(2)}</div>
                {c.status === 'submitted' && (
                  <div style={{ display:'flex', gap:6, marginTop:6, justifyContent:'flex-end' }}>
                    <button onClick={()=>approve(c.id)} disabled={actioning===c.id} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #22c55e40', background:'none', cursor:'pointer', color:'#22c55e' }}>{actioning===c.id?'…':'✓ Approve'}</button>
                    <button onClick={()=>reject(c.id)} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #ef444440', background:'none', cursor:'pointer', color:'#ef4444' }}>Reject</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Staff tab ─────────────────────────────────────────────────────────────────
function StaffTab() {
  const [staff, setStaff]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ full_name:'', email:'', role:'', company_entity:'Sustain International FZE Ltd', employment_type:'employee', salary_currency:'GBP', monthly_salary:'', bank_account:'', payment_method:'bank_transfer' })

  const load = () => {
    setLoading(true)
    fetch('/api/payroll?type=staff').then(r=>r.json()).then(d=>{ setStaff(d.staff??[]); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  async function addStaff() {
    if (!form.full_name.trim() || !form.email.trim()) return
    setSaving(true)
    await fetch('/api/payroll', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'add_staff', staff: { ...form, monthly_salary: parseFloat(form.monthly_salary)||null } }) })
    setForm({ full_name:'', email:'', role:'', company_entity:'Sustain International FZE Ltd', employment_type:'employee', salary_currency:'GBP', monthly_salary:'', bank_account:'', payment_method:'bank_transfer' })
    setShowAdd(false); setSaving(false); load()
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ fontSize:13, color:'var(--pios-muted)' }}>{staff.length} active staff members</span>
        <button className="pios-btn pios-btn-primary" onClick={()=>setShowAdd(!showAdd)} style={{ fontSize:12 }}>+ Add staff</button>
      </div>

      {showAdd && (
        <div className="pios-card" style={{ marginBottom:16, borderColor:'rgba(167,139,250,0.3)' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:10, color:'#a78bfa' }}>Add Staff Member</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <input className="pios-input" placeholder="Full name *" value={form.full_name} onChange={e=>setForm(p=>({...p,full_name:e.target.value}))} />
            <input className="pios-input" placeholder="Email *" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} />
            <input className="pios-input" placeholder="Role / job title" value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} />
            <select className="pios-input" value={form.company_entity} onChange={e=>setForm(p=>({...p,company_entity:e.target.value}))}>
              {['Sustain International FZE Ltd','Sustain International UK Ltd','VeritasIQ Technologies Ltd'].map(e=><option key={e} value={e}>{e}</option>)}
            </select>
            <select className="pios-input" value={form.employment_type} onChange={e=>setForm(p=>({...p,employment_type:e.target.value}))}>
              {['employee','contractor','consultant','director'].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ display:'flex', gap:6 }}>
              <select className="pios-input" style={{ width:'auto' }} value={form.salary_currency} onChange={e=>setForm(p=>({...p,salary_currency:e.target.value}))}>
                {['GBP','USD','SAR','AED','EUR'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <input className="pios-input" placeholder="Monthly salary" type="number" value={form.monthly_salary} onChange={e=>setForm(p=>({...p,monthly_salary:e.target.value}))} />
            </div>
          </div>
          <input className="pios-input" placeholder="Bank account (last 4 digits only — never store full number)" value={form.bank_account} onChange={e=>setForm(p=>({...p,bank_account:e.target.value.slice(0,4)}))} style={{ marginBottom:10 }} maxLength={4} />
          <div style={{ display:'flex', gap:8 }}>
            <button className="pios-btn pios-btn-primary" onClick={addStaff} disabled={saving} style={{ fontSize:12 }}>{saving?'Adding…':'Add staff member'}</button>
            <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAdd(false)} style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : staff.length===0 ? (
        <div className="pios-card" style={{ textAlign:'center' as const, padding:'40px' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>👥</div>
          <div style={{ fontSize:13, color:'var(--pios-muted)' }}>No staff members added yet.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
          {staff.map(s => (
            <div key={s.id} className="pios-card" style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:'rgba(167,139,250,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#a78bfa', flexShrink:0 }}>{s.full_name.charAt(0)}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{s.full_name}</div>
                <div style={{ fontSize:11, color:'var(--pios-muted)', display:'flex', gap:8 }}>
                  <span>{s.email}</span>
                  {s.role && <><span>·</span><span>{s.role}</span></>}
                  <span>·</span><span>{s.employment_type}</span>
                </div>
              </div>
              <div style={{ textAlign:'right' as const }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{s.salary_currency} {parseFloat(s.monthly_salary??0).toFixed(0)}/mo</div>
                <div style={{ fontSize:11, color:'var(--pios-dim)' }}>{s.company_entity?.replace('Sustain International ','').replace(' Ltd','')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Chase tab ─────────────────────────────────────────────────────────────────
function ChaseTab() {
  const [checking, setChecking]   = useState(false)
  const [chaseResult, setChaseResult] = useState<any>(null)
  const [log, setLog]             = useState<any[]>([])
  const [accountantEmail, setAccountantEmail] = useState('')
  const [expectedDate, setExpectedDate] = useState('')

  useEffect(() => {
    fetch('/api/payroll/chase').then(r=>r.json()).then(d=>setLog(d.log??[]))
  }, [])

  async function checkPayroll() {
    setChecking(true); setChaseResult(null)
    const res = await fetch('/api/payroll/chase', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ accountant_email:accountantEmail||undefined, expected_date:expectedDate||undefined }) })
    const d = await res.json()
    setChaseResult(d); setChecking(false)
    if (!d.chase_needed || d.chase_needed) {
      fetch('/api/payroll/chase').then(r=>r.json()).then(x=>setLog(x.log??[]))
    }
  }

  const levelColour = { reminder:'#f59e0b', escalation:'#f97316', formal:'#ef4444' }

  return (
    <div>
      <div className="pios-card" style={{ marginBottom:16, borderLeft:'3px solid #a78bfa' }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>Payroll Chase Checker</div>
        <p style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.65, marginBottom:14 }}>
          Checks whether payroll has been received from your accountant this month.
          If overdue, generates a graded chase email (reminder → escalation → formal).
          The draft is shown for your review — PIOS will not send it automatically.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
          <input className="pios-input" placeholder="Accountant email (optional)" value={accountantEmail} onChange={e=>setAccountantEmail(e.target.value)} />
          <input type="date" className="pios-input" value={expectedDate} onChange={e=>setExpectedDate(e.target.value)} placeholder="Expected date (defaults to last working day)" />
        </div>
        <button className="pios-btn pios-btn-primary" onClick={checkPayroll} disabled={checking} style={{ fontSize:12 }}>
          {checking ? '⟳ Checking…' : '🔍 Check payroll status'}
        </button>
      </div>

      {chaseResult && (
        <div className="pios-card" style={{ marginBottom:16, borderLeft:`3px solid ${chaseResult.chase_needed?(levelColour as any)[chaseResult.chase_level]??'#f59e0b':'#22c55e'}` }}>
          {!chaseResult.chase_needed ? (
            <div style={{ fontSize:13, color:'#22c55e' }}>✓ {chaseResult.message}</div>
          ) : chaseResult.already_sent ? (
            <div style={{ fontSize:13, color:'var(--pios-muted)' }}>⚠ {chaseResult.message}</div>
          ) : (
            <>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
                <Badge label={chaseResult.chase_level} colour={(levelColour as any)[chaseResult.chase_level]??'#f59e0b'} />
                <span style={{ fontSize:13, fontWeight:600 }}>{chaseResult.days_overdue} days overdue</span>
              </div>
              {chaseResult.draft && (
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--pios-muted)', marginBottom:6 }}>Draft email:</div>
                  <div style={{ padding:'10px 14px', borderRadius:8, background:'var(--pios-surface2)', marginBottom:10 }}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:4 }}>Subject: {chaseResult.draft.subject}</div>
                    <div style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.65, whiteSpace:'pre-wrap' as const }}>{chaseResult.draft.body}</div>
                  </div>
                  <p style={{ fontSize:11, color:'#f59e0b' }}>⚠ Review and copy this email to send manually. PIOS has not sent this email.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {log.length > 0 && (
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--pios-muted)', marginBottom:10, textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Chase history</div>
          <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
            {log.map(l => (
              <div key={l.id} style={{ padding:'10px 14px', borderRadius:8, background:'var(--pios-surface)', border:'1px solid var(--pios-border)', display:'flex', alignItems:'center', gap:10 }}>
                <Badge label={l.chase_level} colour={(levelColour as any)[l.chase_level]??'#f59e0b'} />
                <span style={{ fontSize:12, flex:1 }}>Payroll {l.days_overdue}d overdue — expected {l.expected_date}</span>
                <span style={{ fontSize:11, color:'var(--pios-dim)' }}>{new Date(l.sent_at).toLocaleDateString('en-GB')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PayrollPage() {
  const [tab, setTab] = useState<Tab>('runs')

  return (
    <div className="fade-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Payroll & Finance Workflows</h1>
        <p style={{ fontSize:13, color:'var(--pios-muted)' }}>
          Payroll runs · Remittances · Transfer queue · Expense claims · Accountant chase
        </p>
      </div>
      <div style={{ display:'flex', gap:2, borderBottom:'1px solid var(--pios-border)', marginBottom:20 }}>
        <TabBtn active={tab==='runs'}      onClick={()=>setTab('runs')}>💳 Payroll Runs</TabBtn>
        <TabBtn active={tab==='transfers'} onClick={()=>setTab('transfers')}>🏦 Transfer Queue</TabBtn>
        <TabBtn active={tab==='claims'}    onClick={()=>setTab('claims')}>🧾 Expense Claims</TabBtn>
        <TabBtn active={tab==='staff'}     onClick={()=>setTab('staff')}>👥 Staff</TabBtn>
        <TabBtn active={tab==='chase'}     onClick={()=>setTab('chase')}>📧 Chase</TabBtn>
      </div>
      {tab==='runs'      && <RunsTab />}
      {tab==='transfers' && <TransfersTab />}
      {tab==='claims'    && <ClaimsTab />}
      {tab==='staff'     && <StaffTab />}
      {tab==='chase'     && <ChaseTab />}
    </div>
  )
}
