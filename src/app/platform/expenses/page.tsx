'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { domainColour, domainLabel, formatDate } from '@/lib/utils'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ description:'', amount:'', category:'', domain:'personal', date:new Date().toISOString().slice(0,10), currency:'GBP' })
  const supabase = createClient()

  useEffect(() => { load() }, [])
  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('expenses').select('*').eq('user_id',user.id).order('date',{ascending:false}).limit(50)
    setExpenses(data ?? [])
    setLoading(false)
  }
  async function add() {
    if (!form.description.trim() || !form.amount) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('expenses').insert({ ...form, amount:parseFloat(form.amount), user_id:user.id })
    setForm({ description:'', amount:'', category:'', domain:'personal', date:new Date().toISOString().slice(0,10), currency:'GBP' })
    setShowAdd(false); load()
  }

  const total = expenses.reduce((s,e)=>s+(parseFloat(e.amount)||0),0)
  const thisMonth = expenses.filter(e=>e.date?.startsWith(new Date().toISOString().slice(0,7))).reduce((s,e)=>s+(parseFloat(e.amount)||0),0)

  return (
    <div className="fade-in">
      <div style={{ marginBottom:'24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h1 style={{ fontSize:'22px', fontWeight:700 }}>Expenses</h1>
        <button className="pios-btn pios-btn-primary" onClick={()=>setShowAdd(!showAdd)} style={{ fontSize:'12px' }}>+ Add Expense</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'20px' }}>
        {[
          { label:'This month', value:`£${thisMonth.toFixed(2)}`, colour:'#a78bfa' },
          { label:'Total tracked', value:`£${total.toFixed(2)}`, colour:'#6c8eff' },
          { label:'Entries', value:expenses.length, colour:'#2dd4a0' },
        ].map(s=>(
          <div key={s.label} className="pios-card-sm">
            <div style={{ fontSize:'20px', fontWeight:700, color:s.colour, marginBottom:'4px' }}>{s.value}</div>
            <div style={{ fontSize:'12px', color:'var(--pios-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>
      {showAdd && (
        <div className="pios-card" style={{ marginBottom:'16px', borderColor:'rgba(167,139,250,0.3)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto auto', gap:'8px', marginBottom:'10px' }}>
            <input className="pios-input" placeholder="Description…" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} />
            <input type="number" className="pios-input" placeholder="Amount" style={{ width:'100px' }} value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} />
            <input className="pios-input" placeholder="Category" style={{ width:'120px' }} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} />
            <select className="pios-input" style={{ width:'auto' }} value={form.domain} onChange={e=>setForm(p=>({...p,domain:e.target.value}))}>
              {['academic','fm_consulting','saas','business','personal'].map(d=><option key={d} value={d}>{domainLabel(d)}</option>)}
            </select>
            <input type="date" className="pios-input" style={{ width:'auto' }} value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} />
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="pios-btn pios-btn-primary" onClick={add} style={{ fontSize:'12px' }}>Add</button>
            <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAdd(false)} style={{ fontSize:'12px' }}>Cancel</button>
          </div>
        </div>
      )}
      <div className="pios-card" style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--pios-border)' }}>
              {['Date','Description','Category','Domain','Amount'].map(h=>(
                <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'var(--pios-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses.map((e,i) => (
              <tr key={e.id} style={{ borderBottom:'1px solid var(--pios-border)', background:i%2===0?'transparent':'rgba(255,255,255,0.02)' }}>
                <td style={{ padding:'10px 16px', fontSize:'12px', color:'var(--pios-muted)' }}>{formatDate(e.date)}</td>
                <td style={{ padding:'10px 16px', fontSize:'13px' }}>{e.description}</td>
                <td style={{ padding:'10px 16px', fontSize:'12px', color:'var(--pios-muted)' }}>{e.category||'—'}</td>
                <td style={{ padding:'10px 16px' }}>
                  <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'20px', background:`${domainColour(e.domain)}20`, color:domainColour(e.domain) }}>{domainLabel(e.domain)}</span>
                </td>
                <td style={{ padding:'10px 16px', fontSize:'13px', fontWeight:600, color:'var(--pios-text)' }}>{e.currency} {parseFloat(e.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length === 0 && <p style={{ textAlign:'center', padding:'40px', color:'var(--pios-dim)', fontSize:'13px' }}>No expenses logged yet</p>}
      </div>
    </div>
  )
}
