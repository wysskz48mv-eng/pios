'use client'
import { useEffect, useState, useCallback } from 'react'
import { domainColour, domainLabel } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Expenses — tracking, tax year breakdown, category summary, delete
// Server-side via /api/expenses (validation + AI categorise + CSV export)
// PIOS v2.2 | VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ['travel','software','research','consulting','equipment','meals','accommodation','professional_fees','other']
const CURRENCIES = ['GBP','USD','SAR','AED','EUR']
const DOMAINS    = ['academic','fm_consulting','saas','business','personal'] as const

function getTaxYear(date: string): string {
  const d = new Date(date)
  const y = d.getFullYear(), m = d.getMonth()+1, day = d.getDate()
  if (m < 4 || (m===4 && day < 6)) return `${y-1}-${String(y).slice(2)}`
  return `${y}-${String(y+1).slice(2)}`
}

function Bar({ pct, colour='#6c8eff' }: { pct:number; colour?:string }) {
  return <div style={{ height:4,background:'var(--pios-surface2)',borderRadius:2,overflow:'hidden' }}>
    <div style={{ height:'100%',width:`${Math.min(100,pct)}%`,background:colour,borderRadius:2,transition:'width 0.4s' }} />
  </div>
}

export default function ExpensesPage() {
  const [expenses,     setExpenses]     = useState<unknown[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [showAdd,      setShowAdd]      = useState(false)
  const [deleting,     setDeleting]     = useState<string|null>(null)
  const [editing,      setEditing]      = useState<string|null>(null)
  const [editForm,     setEditForm]     = useState<unknown>(null)
  const [taxYear,      setTaxYear]      = useState('all')
  const [domainFilter, setDomainFilter] = useState('all')
  const [aiLoading,    setAiLoading]    = useState(false)
  const [form, setForm] = useState({ description:'', amount:'', category:'', domain:'personal', date:new Date().toISOString().slice(0,10), currency:'GBP', billable:false, client:'', notes:'' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/expenses?limit=200')
    if (res.ok) {
      const data = await res.json()
      setExpenses(data.expenses ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function aiCategorise() {
    if (!form.description.trim()) return
    setAiLoading(true)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ai_categorise', description: form.description, amount: form.amount, currency: form.currency }),
    })
    if (res.ok) {
      const { suggestion } = await res.json()
      if (suggestion?.category) setForm(p => ({ ...p, category: suggestion.category, domain: suggestion.domain ?? p.domain, billable: suggestion.billable ?? p.billable }))
    }
    setAiLoading(false)
  }

  async function add() {
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...form }),
    })
    if (res.ok) {
      // Notify on large expenses
      const amt = parseFloat(form.amount)
      const thresholds: Record<string,number> = { GBP:500, EUR:500, USD:500, AED:2000, SAR:2000 }
      if (amt >= (thresholds[form.currency] ?? 500)) {
        await fetch('/api/notifications', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'create', title:`Large expense: ${form.currency} ${amt.toFixed(0)} — ${form.description}`, type:'warning', domain:form.domain, action_url:'/platform/expenses' }) })
      }
      setForm({ description:'', amount:'', category:'', domain:'personal', date:new Date().toISOString().slice(0,10), currency:'GBP', billable:false, client:'', notes:'' })
      setShowAdd(false)
      load()
    }
    setSaving(false)
  }

  async function del(id: string) {
    setDeleting(id)
    await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' })
    setExpenses(p => p.filter(e => e.id !== id))
    setDeleting(null)
  }

  async function saveEdit() {
    if (!editForm || !editing) return
    const res = await fetch('/api/expenses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing, ...editForm }),
    })
    if (res.ok) {
      const { expense } = await res.json()
      setExpenses(p => p.map(e => e.id === editing ? expense : e))
    }
    setEditing(null); setEditForm(null)
  }

  function startEdit(e: unknown) {
    setEditing(e.id)
    setEditForm({ description:e.description, amount:String(e.amount), category:e.category||'', domain:e.domain||'personal', date:e.date||'', currency:e.currency||'GBP', billable:!!e.billable, client:e.client||'', notes:e.notes||'' })
  }

  async function exportCSV() {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export_csv' }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `expenses-${taxYear === 'all' ? 'all' : taxYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filter
  const filtered = expenses.filter(e => {
    if (taxYear !== 'all' && getTaxYear(e.date) !== taxYear) return false
    if (domainFilter !== 'all' && e.domain !== domainFilter) return false
    return true
  })

  // Tax years available
  const taxYears = Array.from(new Set(expenses.map(e => getTaxYear(e.date)))).sort().reverse()

  // Summaries
  const total      = filtered.reduce((s,e)=>s+(parseFloat(e.amount)||0),0)
  const thisMonth  = filtered.filter(e=>e.date?.startsWith(new Date().toISOString().slice(0,7))).reduce((s,e)=>s+(parseFloat(e.amount)||0),0)
  const billable   = filtered.filter(e=>e.billable).reduce((s,e)=>s+(parseFloat(e.amount)||0),0)

  // By category
  const byCat: Record<string,number> = {}
  filtered.forEach(e => { const c=e.category||'other'; byCat[c]=(byCat[c]||0)+(parseFloat(e.amount)||0) })
  const catEntries = Object.entries(byCat).sort((a,b)=>b[1]-a[1])
  const maxCat = catEntries[0]?.[1] ?? 1

  // By domain
  const byDomain: Record<string,number> = {}
  filtered.forEach(e => { byDomain[e.domain]=(byDomain[e.domain]||0)+(parseFloat(e.amount)||0) })

  const currency = filtered[0]?.currency ?? 'GBP'
  const fmt = (n:number) => `${currency} ${n.toFixed(2)}`

  return (
    <div className="fade-in">
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:700,marginBottom:4 }}>Expenses</h1>
          <p style={{ fontSize:13,color:'var(--pios-muted)' }}>Track, categorise, and reconcile for tax purposes</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={exportCSV} className="pios-btn pios-btn-ghost" style={{ fontSize:12 }}>↓ Export CSV</button>
          <button className="pios-btn pios-btn-primary" onClick={()=>setShowAdd(!showAdd)} style={{ fontSize:12 }}>+ Add expense</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
        {[
          { label:'This month',     value:fmt(thisMonth), colour:'#a78bfa' },
          { label:'Total (filtered)', value:fmt(total),    colour:'#6c8eff' },
          { label:'Billable',       value:fmt(billable),  colour:'#22c55e' },
          { label:'Entries',        value:filtered.length, colour:'#2dd4a0' },
        ].map(s=>(
          <div key={s.label} className="pios-card-sm" style={{ padding:'12px 14px' }}>
            <div style={{ fontSize:18,fontWeight:800,color:s.colour,lineHeight:1,marginBottom:3 }}>{s.value}</div>
            <div style={{ fontSize:11,color:'var(--pios-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="pios-card" style={{ marginBottom:16,borderColor:'rgba(167,139,250,0.3)' }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr auto auto auto auto',gap:8,marginBottom:8 }}>
            <input className="pios-input" placeholder="Description *" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} />
            <input type="number" className="pios-input" placeholder="Amount" style={{ width:100 }} value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} />
            <select className="pios-input" style={{ width:'auto' }} value={form.currency} onChange={e=>setForm(p=>({...p,currency:e.target.value}))}>
              {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select className="pios-input" style={{ width:'auto' }} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
              <option value="">Category…</option>
              {CATEGORIES.map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}
            </select>
            <input type="date" className="pios-input" style={{ width:'auto' }} value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} />
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'auto 1fr 1fr auto',gap:8,marginBottom:8 }}>
            <select className="pios-input" style={{ width:'auto' }} value={form.domain} onChange={e=>setForm(p=>({...p,domain:e.target.value}))}>
              {DOMAINS.map(d=><option key={d} value={d}>{domainLabel(d)}</option>)}
            </select>
            <input className="pios-input" placeholder="Client (if billable)" value={form.client} onChange={e=>setForm(p=>({...p,client:e.target.value}))} />
            <input className="pios-input" placeholder="Notes" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} />
            <label style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer',whiteSpace:'nowrap' as const }}>
              <input type="checkbox" checked={form.billable} onChange={e=>setForm(p=>({...p,billable:e.target.checked}))} />
              Billable
            </label>
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <button className="pios-btn pios-btn-primary" onClick={add} disabled={saving} style={{ fontSize:12 }}>{saving ? 'Saving…' : 'Add expense'}</button>
            <button className="pios-btn pios-btn-ghost" onClick={aiCategorise} disabled={aiLoading||!form.description.trim()} style={{ fontSize:12 }}>
              {aiLoading ? '…' : '✦ AI categorise'}
            </button>
            <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAdd(false)} style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20 }}>
        {/* By category */}
        <div className="pios-card">
          <div style={{ fontSize:13,fontWeight:700,marginBottom:14 }}>By category</div>
          {catEntries.length===0 ? <p style={{ fontSize:12,color:'var(--pios-dim)' }}>No data</p> : (
            <div style={{ display:'flex',flexDirection:'column' as const,gap:10 }}>
              {catEntries.map(([cat,amt])=>(
                <div key={cat}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                    <span style={{ fontSize:12,fontWeight:500 }}>{cat.replace('_',' ')}</span>
                    <span style={{ fontSize:12,fontWeight:700 }}>{fmt(amt)}</span>
                  </div>
                  <Bar pct={(amt/maxCat)*100} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By domain */}
        <div className="pios-card">
          <div style={{ fontSize:13,fontWeight:700,marginBottom:14 }}>By domain</div>
          {Object.keys(byDomain).length===0 ? <p style={{ fontSize:12,color:'var(--pios-dim)' }}>No data</p> : (
            <div style={{ display:'flex',flexDirection:'column' as const,gap:10 }}>
              {Object.entries(byDomain).sort((a,b)=>b[1]-a[1]).map(([dom,amt])=>(
                <div key={dom}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                    <span style={{ fontSize:12,fontWeight:500 }}>{domainLabel(dom)}</span>
                    <span style={{ fontSize:12,fontWeight:700,color:domainColour(dom) }}>{fmt(amt)}</span>
                  </div>
                  <Bar pct={(amt/total)*100} colour={domainColour(dom)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex',gap:12,marginBottom:16,flexWrap:'wrap' as const,alignItems:'center' }}>
        <div style={{ display:'flex',gap:4,flexWrap:'wrap' as const }}>
          {[['all','All years'],...taxYears.map(y=>[y,`${y} tax year`])].map(([v,l])=>(
            <button key={v} onClick={()=>setTaxYear(v)} style={{ padding:'4px 12px',borderRadius:20,fontSize:11,border:'1px solid var(--pios-border)',background:taxYear===v?'var(--pios-surface)':'transparent',color:taxYear===v?'var(--pios-text)':'var(--pios-muted)',fontWeight:taxYear===v?600:400,cursor:'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ width:'1px',height:20,background:'var(--pios-border)' }} />
        <div style={{ display:'flex',gap:4,flexWrap:'wrap' as const }}>
          {(['all',...DOMAINS] as const).map(d=>(
            <button key={d} onClick={()=>setDomainFilter(d)} style={{ padding:'4px 12px',borderRadius:20,fontSize:11,border:'none',cursor:'pointer',background:domainFilter===d?domainColour(d==='all'?'personal':d):'var(--pios-surface2)',color:domainFilter===d?'#0a0b0d':'var(--pios-muted)',fontWeight:domainFilter===d?600:400 }}>
              {d==='all'?'All':domainLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? <p style={{ textAlign:'center' as const,padding:'40px',color:'var(--pios-muted)',fontSize:13 }}>Loading…</p> : (
        <div className="pios-card" style={{ padding:0,overflow:'hidden' }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--pios-border)' }}>
                {['Date','Description','Category','Domain','Notes','Amount',''].map(h=>(
                  <th key={h} style={{ padding:'10px 14px',textAlign:'left' as const,fontSize:11,fontWeight:600,color:'var(--pios-muted)',textTransform:'uppercase' as const,letterSpacing:'0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e,i)=>(
                <tr key={e.id} style={{ borderBottom:'1px solid var(--pios-border)',background:i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding:'10px 14px',fontSize:12,color:'var(--pios-muted)',whiteSpace:'nowrap' as const }}>{e.date}</td>
                  <td style={{ padding:'10px 14px',fontSize:13 }}>
                    {editing === e.id ? (
                      <input value={editForm.description} onChange={ev=>setEditForm((p: unknown)=>({...p,description:ev.target.value}))}
                        className="pios-input" style={{ fontSize:12,padding:'4px 8px',width:'100%' }} autoFocus onKeyDown={ev=>{if(ev.key==='Enter')saveEdit();if(ev.key==='Escape'){setEditing(null);setEditForm(null)}}} />
                    ) : (
                      <span onClick={()=>startEdit(e)} style={{ cursor:'text' }} title="Click to edit">{e.description}</span>
                    )}
                    {!editing&&e.billable&&<span style={{ marginLeft:6,fontSize:10,padding:'1px 6px',borderRadius:10,background:'rgba(34,197,94,0.1)',color:'#22c55e',fontWeight:600 }}>Billable{e.client?` · ${e.client}`:''}</span>}
                  </td>
                  <td style={{ padding:'10px 14px',fontSize:12,color:'var(--pios-muted)' }}>{e.category?.replace('_',' ')||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ fontSize:10,padding:'2px 8px',borderRadius:20,background:`${domainColour(e.domain)}20`,color:domainColour(e.domain) }}>{domainLabel(e.domain)}</span>
                  </td>
                  <td style={{ padding:'10px 14px',fontSize:11,color:'var(--pios-dim)',maxWidth:200 }}><span style={{ overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,display:'block' }}>{e.notes||'—'}</span></td>
                  <td style={{ padding:'10px 14px',fontSize:13,fontWeight:700,whiteSpace:'nowrap' as const }}>{e.currency} {parseFloat(e.amount).toFixed(2)}</td>
                  <td style={{ padding:'10px 14px',textAlign:'right' as const,whiteSpace:'nowrap' as const }}>
                    {editing === e.id ? (
                      <div style={{ display:'flex',gap:4 }}>
                        <button onClick={saveEdit} style={{ fontSize:11,padding:'3px 8px',borderRadius:6,border:'1px solid rgba(34,197,94,0.3)',background:'rgba(34,197,94,0.1)',cursor:'pointer',color:'#22c55e' }}>✓</button>
                        <button onClick={()=>{setEditing(null);setEditForm(null)}} style={{ fontSize:11,padding:'3px 8px',borderRadius:6,border:'1px solid var(--pios-border)',background:'none',cursor:'pointer',color:'var(--pios-muted)' }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display:'flex',gap:4 }}>
                        <button onClick={()=>startEdit(e)} style={{ fontSize:11,padding:'3px 8px',borderRadius:6,border:'1px solid var(--pios-border)',background:'none',cursor:'pointer',color:'var(--pios-muted)' }}>✎</button>
                        <button onClick={()=>del(e.id)} disabled={deleting===e.id} style={{ fontSize:11,padding:'3px 8px',borderRadius:6,border:'1px solid rgba(239,68,68,0.2)',background:'none',cursor:'pointer',color:'#ef4444' }}>
                          {deleting===e.id?'…':'✕'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0&&<p style={{ textAlign:'center' as const,padding:'40px',color:'var(--pios-dim)',fontSize:13 }}>No expenses match the current filters.</p>}
        </div>
      )}
    </div>
  )
}
