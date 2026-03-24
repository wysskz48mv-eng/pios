'use client'
import { useEffect, useState, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// File Intelligence — Drive scan, folder structure, invoice tracker, filing rules
// ─────────────────────────────────────────────────────────────────────────────

const TABS = ['structure', 'files', 'invoices', 'rules'] as const
type Tab = typeof TABS[number]

const CAT_COLOURS: Record<string, string> = {
  invoice: '#f59e0b', contract: '#6c8eff', report: '#2dd4a0',
  proposal: '#a78bfa', correspondence: '#22d3ee', technical: '#22c55e',
  financial: '#f59e0b', legal: '#e05a7a', academic: '#6c8eff',
  other: '#64748b', unprocessed: '#475569',
}

const INV_STATUS: Record<string, string> = {
  pending: '#f59e0b', approved: '#6c8eff', paid: '#22c55e',
  overdue: '#ef4444', disputed: '#e05a7a', cancelled: '#64748b',
}

function Pill({ label, colour }: { label: string; colour: string }) {
  return <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:colour+'20', color:colour, fontWeight:600, whiteSpace:'nowrap' as const }}>{label}</span>
}

function Spinner({ label='Loading…' }: { label?: string }) {
  return <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--pios-muted)', fontSize:13, padding:'32px 0', justifyContent:'center' }}>
    <div style={{ width:14, height:14, border:'2px solid rgba(108,142,255,0.2)', borderTop:'2px solid #6c8eff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />{label}
  </div>
}

function TabBtn({ active, onClick, children }: { active:boolean; onClick:()=>void; children:React.ReactNode }) {
  return <button onClick={onClick} style={{ padding:'8px 18px', fontSize:13, fontWeight:active?600:400, border:'none', borderBottom:`2px solid ${active?'#6c8eff':'transparent'}`, background:'none', cursor:'pointer', color:active?'#6c8eff':'var(--pios-muted)', marginBottom:-1, transition:'all 0.15s' }}>{children}</button>
}

// ── Folder tree ───────────────────────────────────────────────────────────────
function FolderNode({ space, all, depth=0, onSelect, selected }: { space:any; all:any[]; depth?:number; onSelect:(s: unknown)=>void; selected:any }) {
  const [open, setOpen] = useState(depth < 1)
  const children = all.filter((s: Record<string,unknown>) => (s as Record<string,unknown>).parent_id === space.id)
  const isSelected = selected?.id === space.id
  return (
    <div>
      <div onClick={() => { setOpen(!open); onSelect(space) }} style={{
        display:'flex', alignItems:'center', gap:8, padding:`6px ${8+depth*16}px`,
        cursor:'pointer', borderRadius:6, marginBottom:2,
        background: isSelected ? 'rgba(108,142,255,0.12)' : 'transparent',
        border: `1px solid ${isSelected ? 'rgba(108,142,255,0.3)' : 'transparent'}`,
      }}>
        <span style={{ fontSize:14 }}>{String(space.icon ?? "")}</span>
        <span style={{ fontSize:13, fontWeight:depth===0?600:400, flex:1, color:space.colour??'var(--pios-text)' }}>{String(space.name ?? "")}</span>
        {children.length > 0 && <span style={{ fontSize:11, color:'var(--pios-dim)' }}>{open?'▾':'▸'}</span>}
      </div>
      {open && children.map(c => <FolderNode key={(c as Record<string,unknown>).id as string} space={c} all={all} depth={depth+1} onSelect={onSelect} selected={selected} />)}
    </div>
  )
}

// ── Structure tab ─────────────────────────────────────────────────────────────
function StructureTab({ spaces, onScan, scanning, scanResult, stats }: { spaces:any[]; onScan:(folder:string)=>void; scanning:boolean; scanResult:any; stats:any }) {
  const [selectedSpace, setSelectedSpace] = useState<FileSpace|null>(null)
  const [showAddSpace, setShowAddSpace] = useState(false)
  const [newSpace, setNewSpace] = useState({ name:'', space_type:'folder', icon:'📁', colour:'#6c8eff' })
  const roots = spaces.filter(s => !s.parent_id)

  async function addSpace() {
    if (!newSpace.name.trim()) return
    const path = selectedSpace ? `${selectedSpace.path}/${newSpace.name}` : `/${newSpace.name}`
    await fetch('/api/files', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'create_space', ...newSpace, path, parent_id: selectedSpace?.id ?? null }) })
    setShowAddSpace(false)
    window.location.reload()
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20 }}>
      {/* Folder tree */}
      <div className="pios-card" style={{ padding:'16px 8px', height:'fit-content', minHeight:400 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 8px', marginBottom:12 }}>
          <span style={{ fontSize:12, fontWeight:600, color:'var(--pios-muted)', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Folders</span>
          <button onClick={()=>setShowAddSpace(!showAddSpace)} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid var(--pios-border)', background:'none', cursor:'pointer', color:'#6c8eff' }}>+</button>
        </div>
        {showAddSpace && (
          <div style={{ padding:'0 8px', marginBottom:12 }}>
            <input className="pios-input" placeholder="Folder name…" value={newSpace.name} onChange={e=>setNewSpace(p=>({...p,name:e.target.value}))} style={{ marginBottom:6, fontSize:12 }} />
            <div style={{ display:'flex', gap:4 }}>
              <button onClick={addSpace} className="pios-btn pios-btn-primary" style={{ fontSize:11, flex:1 }}>Add</button>
              <button onClick={()=>setShowAddSpace(false)} className="pios-btn pios-btn-ghost" style={{ fontSize:11 }}>✕</button>
            </div>
          </div>
        )}
        {roots.map(s => <FolderNode key={(s as Record<string,unknown>).id as string} space={s} all={spaces} onSelect={(s) => setSelectedSpace(s as FileSpace | null)} selected={selectedSpace} />)}
      </div>

      {/* Right panel */}
      <div style={{ display:'flex', flexDirection:'column' as const, gap:16 }}>
        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[
            { label:'Folders', value:stats?.spaces??0, colour:'#6c8eff' },
            { label:'Files indexed', value:stats?.files??0, colour:'#2dd4a0' },
            { label:'Invoices found', value:stats?.invoices??0, colour:'#f59e0b' },
            { label:'Pending approval', value:stats?.invoicesPending??0, colour:'#ef4444' },
          ].map(s=>(
            <div key={(s as Record<string,unknown>).label as string} className="pios-card-sm" style={{ padding:'12px 14px' }}>
              <div style={{ fontSize:20, fontWeight:800, color:s.colour, lineHeight:1, marginBottom:3 }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--pios-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Scan panel */}
        <div className="pios-card" style={{ borderLeft:'3px solid #6c8eff' }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>Scan Google Drive</div>
          <p style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.65, marginBottom:14 }}>
            PIOS will scan your Drive files, classify them with AI (invoice / contract / report / technical etc.),
            match them to your projects, and propose which folder each file belongs in. Nothing is moved or deleted — read-only scan.
          </p>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button className="pios-btn pios-btn-primary" onClick={()=>onScan('root')} disabled={scanning} style={{ fontSize:12 }}>
              {scanning ? '⟳ Scanning…' : '🔍 Scan My Drive'}
            </button>
            <span style={{ fontSize:11, color:'var(--pios-dim)' }}>Scans up to 50 recent files · AI classifies each one</span>
          </div>
          {scanResult && (
            <div style={{ marginTop:14, padding:'10px 14px', borderRadius:8, background:'rgba(34,197,94,0.08)', borderLeft:'2px solid #22c55e' }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#22c55e', marginBottom:4 }}>Scan complete</div>
              <div style={{ fontSize:12, color:'var(--pios-muted)' }}>
                {scanResult.filesScanned} files scanned · {scanResult.filesClassified} classified · {scanResult.invoicesFound} invoices detected
              </div>
            </div>
          )}
        </div>

        {/* Selected space detail */}
        {selectedSpace && (
          <div className="pios-card">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <span style={{ fontSize:22 }}>{selectedSpace.icon}</span>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>{selectedSpace.name}</div>
                <div style={{ fontSize:11, color:'var(--pios-muted)', fontFamily:'monospace' }}>{selectedSpace.path}</div>
              </div>
            </div>
            <div style={{ fontSize:12, color:'var(--pios-muted)' }}>
              {selectedSpace.drive_folder_id
                ? <span style={{ color:'#22c55e' }}>✓ Linked to Google Drive folder</span>
                : <span>Not yet linked to a Drive folder</span>
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Files tab ─────────────────────────────────────────────────────────────────
function FilesTab({ spaces }: { spaces:any[] }) {
  const [items, setItems]     = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')
  const [extracting, setExtracting] = useState<string|null>(null)
  const [extractMsg,       setExtractMsg]       = useState<string|null>(null)
  const [deleteRuleConfirm, setDeleteRuleConfirm] = useState<string|null>(null)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ type:'items' })
    if (filter !== 'all') params.set('status', filter)
    fetch(`/api/files?${params}`).then(r=>r.json()).then(d=>{ setItems(d.items??[]); setLoading(false) })
  }, [filter])

  const spaceMap = Object.fromEntries(spaces.map(s=>[s.id, s]))

  async function extractInvoice(itemId: string) {
    setExtracting(itemId)
    const res = await fetch('/api/files/invoice', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ source:'file', source_id:itemId }) })
    const data = await res.json()
    setExtracting(null)
    if (data.invoice_id) {
      setExtractMsg(`✓ Invoice extracted (ID: ${data.invoice_id}) — ${data.hitl_message}`)
      setItems(prev => prev.map((i: FileItem) => i.id===itemId ? ({...i, ai_category:'invoice'} as FileItem) : i))
    } else {
      setExtractMsg(`✗ ${data.error ?? 'Extraction failed'}`)
    }
  }

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' as const, alignItems:'center' }}>
        {[['all','All'],['unprocessed','Unprocessed'],['classified','Classified'],['filed','Filed'],['review_needed','Needs Review']].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, border:'1px solid var(--pios-border)', background:filter===v?'var(--pios-surface)':'transparent', color:filter===v?'var(--pios-text)':'var(--pios-muted)', fontWeight:filter===v?600:400, cursor:'pointer' }}>{l}</button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--pios-dim)' }}>{items.length} files</span>
      </div>

      {loading ? <Spinner /> : items.length===0 ? (
        <div className="pios-card" style={{ textAlign:'center' as const, padding:'48px' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📂</div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>No files indexed yet</div>
          <p style={{ fontSize:13, color:'var(--pios-muted)' }}>Run a Drive scan in the Structure tab to import and classify your files.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
          {items.map(item => {
            const space = item.space_id ? spaceMap[item.space_id] : null
            return (
              <div key={item.id as string} className="pios-card" style={{ padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:12 }}>
                <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>
                  {item.file_type==='pdf'?'📄':item.file_type==='xlsx'||item.file_type==='csv'?'📊':item.file_type==='docx'?'📝':item.file_type?.match(/jpg|jpeg|png|gif/)?'🖼️':'📁'}
                </span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' as const }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>{String(item.name ?? "")}</span>
                    {item.ai_category && <Pill label={item.ai_category} colour={CAT_COLOURS[item.ai_category]??'#64748b'} />}
                    {item.ai_project_tag && <Pill label={item.ai_project_tag} colour="#6c8eff" />}
                    {item.filing_status && <Pill label={item.filing_status.replace('_',' ')} colour={item.filing_status==='filed'?'#22c55e':item.filing_status==='classified'?'#6c8eff':'#64748b'} />}
                  </div>
                  {item.ai_summary && <p style={{ fontSize:12, color:'var(--pios-muted)', lineHeight:1.5, marginBottom:4 }}>{item.ai_summary}</p>}
                  <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' as const }}>
                    {space && <span style={{ fontSize:11, color:space.colour??'#6c8eff' }}>{String(space.icon ?? "")} {String(space.name ?? "")}</span>}
                    {item.drive_web_url && <a href={item.drive_web_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#6c8eff' }}>Open in Drive →</a>}
                    {item.ai_confidence && <span style={{ fontSize:11, color:'var(--pios-dim)' }}>AI: {Math.round(item.ai_confidence*100)}% confident</span>}
                  </div>
                </div>
                {item.ai_category !== 'invoice' && (
                  <button onClick={()=>extractInvoice(item.id)} disabled={extracting===item.id} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #f59e0b40', background:'none', cursor:'pointer', color:'#f59e0b', flexShrink:0 }}>
                    {extracting===item.id ? '⟳' : '💰 Extract invoice'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Invoices tab ──────────────────────────────────────────────────────────────
function InvoicesTab() {
  const [invoices, setInvoices] = useState<FileItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [updating, setUpdating] = useState<string|null>(null)

  const load = useCallback((f=filter) => {
    setLoading(true)
    const params = new URLSearchParams({ type:'invoices' })
    if (f !== 'all') params.set('status', f)
    fetch(`/api/files?${params}`).then(r=>r.json()).then(d=>{ setInvoices(d.invoices??[]); setLoading(false) })
  }, [filter])

  useEffect(() => { load() }, [load])

  async function approveInvoice(id:string, status:'approved'|'paid') {
    setUpdating(id)
    await fetch('/api/files', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'update_invoice', id, status, approved_at: new Date().toISOString() }) })
    setUpdating(null); load()
  }

  const totalPending = invoices.filter(i=>i.status==='pending').reduce((s,i)=>s+(Number(i.total_amount) || 0),0)
  const totalOverdue = invoices.filter(i=>i.status==='overdue').reduce((s,i)=>s+(Number(i.amount_due) || 0),0)

  return (
    <div>
      {/* Summary row */}
      {invoices.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'Pending approval', value:`${invoices.filter(i=>i.status==='pending').length} invoices · ${invoices[0]?.currency??'GBP'} ${totalPending.toFixed(2)}`, colour:'#f59e0b' },
            { label:'Overdue', value:`${invoices.filter(i=>i.status==='overdue').length} · ${invoices[0]?.currency??'GBP'} ${totalOverdue.toFixed(2)}`, colour:'#ef4444' },
            { label:'Total tracked', value:`${invoices.length} invoices`, colour:'#6c8eff' },
          ].map(s=>(
            <div key={(s as Record<string,unknown>).label as string} className="pios-card-sm" style={{ padding:'12px 14px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:s.colour, marginBottom:3 }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--pios-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' as const }}>
        {[['all','All'],['pending','Pending'],['approved','Approved'],['paid','Paid'],['overdue','Overdue']].map(([v,l])=>(
          <button key={v} onClick={()=>{ setFilter(v); load(v) }} style={{ padding:'4px 12px', borderRadius:20, fontSize:11, border:'1px solid var(--pios-border)', background:filter===v?'var(--pios-surface)':'transparent', color:filter===v?'var(--pios-text)':'var(--pios-muted)', fontWeight:filter===v?600:400, cursor:'pointer' }}>{l}</button>
        ))}
      </div>

      {loading ? <Spinner /> : invoices.length===0 ? (
        <div className="pios-card" style={{ textAlign:'center' as const, padding:'48px' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🧾</div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>No invoices yet</div>
          <p style={{ fontSize:13, color:'var(--pios-muted)' }}>Run a Drive scan or use the "Extract invoice" button on a file to populate this list.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
          {invoices.map(inv => (
            <div key={(inv as Record<string,unknown>).id as string} className="pios-card" style={{ padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' as const }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>
                      {inv.invoice_number ?? (inv.supplier_name ? `Invoice from ${inv.supplier_name}` : 'Invoice')}
                    </span>
                    <Pill label={String(inv.status ?? '')} colour={(INV_STATUS as Record<string,string>)[String(inv.status ?? '')] ?? '#64748b'} />
                    <Pill label={inv.invoice_type?.replace('_',' ')??'payable'} colour="#a78bfa" />
                    {inv.ai_extracted && <span style={{ fontSize:10, color:'var(--pios-dim)' }}>AI extracted</span>}
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:12, color:'var(--pios-muted)', flexWrap:'wrap' as const }}>
                    {inv.supplier_name && <span>From: {inv.supplier_name}</span>}
                    {inv.client_name && <span>To: {inv.client_name}</span>}
                    {inv.company_entity && <span>Entity: {inv.company_entity}</span>}
                    {inv.project_id && <span>Project assigned</span>}
                    {inv.invoice_date && <span>Dated: {inv.invoice_date}</span>}
                    {inv.due_date && <span style={{ color: new Date(inv.due_date)<new Date()&&inv.status!=='paid'?'#ef4444':'inherit' }}>Due: {inv.due_date}</span>}
                  </div>
                  {inv.name && <div style={{ fontSize:11, color:'#6c8eff', marginTop:4 }}>📄 {String(inv.name)}</div>}
                  {Boolean((inv.email_items as unknown[])?.length) && <div style={{ fontSize:11, color:'#22d3ee', marginTop:4 }}>✉ linked email</div>}
                </div>
                <div style={{ textAlign:'right' as const, flexShrink:0 }}>
                  <div style={{ fontSize:17, fontWeight:800, marginBottom:4 }}>
                    {inv.currency} {Number(inv.total_amount ?? 0).toFixed(2)}
                  </div>
                  {inv.status === 'pending' && (
                    <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                      <button onClick={()=>approveInvoice(inv.id,'approved')} disabled={updating===inv.id} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #6c8eff40', background:'none', cursor:'pointer', color:'#6c8eff' }}>Approve</button>
                      <button onClick={()=>approveInvoice(inv.id,'paid')} disabled={updating===inv.id} style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #22c55e40', background:'none', cursor:'pointer', color:'#22c55e' }}>Mark paid</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Rules tab ─────────────────────────────────────────────────────────────────
function RulesTab({ spaces }: { spaces:any[] }) {
  const [rules, setRules]     = useState<FileRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [deleteRuleConfirm, setDeleteRuleConfirm] = useState<string|null>(null)
  const [form, setForm] = useState({ name:'', trigger_type:'email_sender', trigger_value:'', trigger_match:'contains', action_type:'assign_project', action_value:'', priority:50 })
  function f(k:string,v: unknown) { setForm(p=>({...p,[k]:v})) }

  const load = () => {
    setLoading(true)
    fetch('/api/files?type=rules').then(r=>r.json()).then(d=>{ setRules(d.rules??[]); setLoading(false) })
  }
  useEffect(()=>{ load() },[])

  async function saveRule() {
    if (!form.name.trim()||!form.trigger_value.trim()) return
    setSaving(true)
    await fetch('/api/files', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'save_rule', rule:form }) })
    setForm({ name:'', trigger_type:'email_sender', trigger_value:'', trigger_match:'contains', action_type:'assign_project', action_value:'', priority:50 })
    setShowAdd(false); setSaving(false); load()
  }

  async function deleteRule(id:string) {
    if (deleteRuleConfirm !== id) { setDeleteRuleConfirm(id); return }
    setDeleteRuleConfirm(null)
    await fetch('/api/files', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete_rule', id }) })
    load()
  }

  const triggerLabels: Record<string,string> = { email_sender:'Email from', email_subject:'Subject contains', file_name:'Filename contains', file_type:'File type', ai_category:'AI category', keyword:'Keyword' }
  const actionLabels: Record<string,string> = { file_to_space:'File to folder', assign_project:'Assign to project', mark_invoice:'Flag as invoice', tag:'Apply tag', create_task:'Create task', notify:'Send notification' }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>Filing Rules</div>
          <p style={{ fontSize:12, color:'var(--pios-muted)' }}>Rules run automatically when files are scanned or emails are received. Lower priority number = checked first.</p>
        </div>
        <button className="pios-btn pios-btn-primary" onClick={()=>setShowAdd(!showAdd)} style={{ fontSize:12 }}>+ Add rule</button>
      </div>

      {showAdd && (
        <div className="pios-card" style={{ marginBottom:16, borderColor:'rgba(108,142,255,0.3)' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'#6c8eff' }}>New Filing Rule</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <input className="pios-input" placeholder="Rule name *" value={form.name} onChange={e=>f('name',e.target.value)} />
            <input className="pios-input" type="number" placeholder="Priority (1=first)" value={form.priority} onChange={e=>f('priority',parseInt(e.target.value)||50)} style={{ width:'auto' }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:8, marginBottom:8, alignItems:'center' }}>
            <span style={{ fontSize:12, color:'var(--pios-muted)', whiteSpace:'nowrap' as const }}>When</span>
            <select className="pios-input" value={form.trigger_type} onChange={e=>f('trigger_type',e.target.value)}>
              {Object.entries(triggerLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
            <select className="pios-input" style={{ width:'auto' }} value={form.trigger_match} onChange={e=>f('trigger_match',e.target.value)}>
              {['exact','contains','starts_with','ends_with'].map(m=><option key={m} value={m}>{m.replace('_',' ')}</option>)}
            </select>
          </div>
          <input className="pios-input" placeholder="Match value (e.g. ahmed@qiddiya.com, payroll, .pdf)" value={form.trigger_value} onChange={e=>f('trigger_value',e.target.value)} style={{ marginBottom:8 }} />
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:8, marginBottom:8, alignItems:'center' }}>
            <span style={{ fontSize:12, color:'var(--pios-muted)', whiteSpace:'nowrap' as const }}>Then</span>
            <select className="pios-input" value={form.action_type} onChange={e=>f('action_type',e.target.value)}>
              {Object.entries(actionLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <input className="pios-input" placeholder="Action value (project name, folder path, tag name)" value={form.action_value} onChange={e=>f('action_value',e.target.value)} style={{ marginBottom:10 }} />
          <div style={{ display:'flex', gap:8 }}>
            <button className="pios-btn pios-btn-primary" onClick={saveRule} disabled={saving} style={{ fontSize:12 }}>{saving?'Saving…':'Save rule'}</button>
            <button className="pios-btn pios-btn-ghost" onClick={()=>setShowAdd(false)} style={{ fontSize:12 }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : rules.length===0 ? (
        <div className="pios-card" style={{ textAlign:'center' as const, padding:'40px' }}>
          <div style={{ fontSize:13, color:'var(--pios-muted)', marginBottom:12 }}>No rules yet. Run migration 006 to seed default rules, or add your own.</div>
          <button className="pios-btn pios-btn-primary" onClick={()=>setShowAdd(true)} style={{ fontSize:13 }}>Add first rule</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
          {rules.map(rule => (
            <div key={rule.id as string} className="pios-card" style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--pios-dim)', minWidth:24, textAlign:'center' as const }}>{rule.priority}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>{String(rule.name ?? "")}</div>
                <div style={{ fontSize:12, color:'var(--pios-muted)' }}>
                  {(triggerLabels as Record<string,string>)[String(rule.trigger_type ?? '')]} <strong>"{String(rule.trigger_value ?? "")}"</strong> ({rule.trigger_match}) → {(actionLabels as Record<string,string>)[String(rule.action_type ?? '')]}
                  {rule.action_value && <> <strong>"{String(rule.action_value ?? "")}"</strong></>}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, flexShrink:0, alignItems:'center' }}>
                {Number(rule.times_fired ?? 0) > 0 && <span style={{ fontSize:11, color:'var(--pios-dim)' }}>Fired {Number(rule.times_fired ?? 0)}×</span>}
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:rule.is_active?'#22c55e20':'rgba(255,255,255,0.05)', color:rule.is_active?'#22c55e':'var(--pios-dim)', fontWeight:600 }}>{rule.is_active?'Active':'Off'}</span>
                <button onClick={()=>deleteRule(rule.id)} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid rgba(239,68,68,0.2)', background:'none', cursor:'pointer', color:'#ef4444' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type FileItem = {
  id: string; name: string; size?: number; type?: string; file_type?: string
  mime_type?: string; created_at?: string; updated_at?: string
  space_id?: string; space_name?: string; space_type?: string
  path?: string; url?: string; status?: string
  ai_category?: string; ai_summary?: string; subject?: string
  invoice_no?: string; vendor?: string; supplier_name?: string
  amount?: number | string; currency?: string; invoice_date?: string
  confidence?: number; filing_status?: string; due_date?: string
  total_amount?: number | string; file_items?: unknown[]; email_items?: unknown[]
  match?: Record<string,unknown>
  drive_web_url?: string; company_entity?: string; client_name?: string
  ai_project_tag?: string; ai_confidence?: number
  amount_due?: number | string; invoice_number?: string; invoice_type?: string
  ai_extracted?: boolean; project_id?: string; project_name?: string
  [key: string]: unknown
}

type FileSpace = {
  id: string; name: string; space_type?: string
  icon?: string; colour?: string; file_count?: number
  path?: string; drive_folder_id?: string; description?: string
}

type FileRule = {
  id: string; name?: string; trigger_type?: string; trigger_value?: string
  trigger_match?: string; action_type?: string; action_value?: string
  priority?: number; is_active?: boolean; times_fired?: number
  [key: string]: unknown
}

export default function FilesPage() {
  const [tab, setTab]           = useState<Tab>('structure')
  const [spaces, setSpaces]     = useState<FileSpace[]>([])
  const [stats, setStats]       = useState<Record<string,unknown>|null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<Record<string,unknown>|null>(null)

  useEffect(() => {
    fetch('/api/files?type=spaces').then(r=>r.json()).then(d=>setSpaces(d.spaces??[]))
    fetch('/api/files?type=stats').then(r=>r.json()).then(d=>setStats(d))
  }, [])

  async function runScan(folderId: string) {
    setScanning(true); setScanResult(null)
    const res = await fetch('/api/files/scan', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ folder_id:folderId, max_files:50, apply_rules:true }) })
    const data = await res.json()
    setScanResult(data)
    setScanning(false)
    // Refresh stats and switch to files tab
    fetch('/api/files?type=stats').then(r=>r.json()).then(d=>setStats(d))
    setTab('files')
  }

  return (
    <div className="fade-in">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>File Intelligence</h1>
        <p style={{ fontSize:13, color:'var(--pios-muted)' }}>
          Drive scan · AI classification · Invoice extraction · Structured filing · Routing rules
        </p>
      </div>

      <div style={{ display:'flex', gap:2, borderBottom:'1px solid var(--pios-border)', marginBottom:20 }}>
        <TabBtn active={tab==='structure'} onClick={()=>setTab('structure')}>🗂️ Folder Structure</TabBtn>
        <TabBtn active={tab==='files'}     onClick={()=>setTab('files')}>📄 Files</TabBtn>
        <TabBtn active={tab==='invoices'}  onClick={()=>setTab('invoices')}>🧾 Invoices</TabBtn>
        <TabBtn active={tab==='rules'}     onClick={()=>setTab('rules')}>⚙ Filing Rules</TabBtn>
      </div>

      {tab==='structure' && <StructureTab spaces={spaces} onScan={runScan} scanning={scanning} scanResult={scanResult} stats={stats} />}
      {tab==='files'     && <FilesTab spaces={spaces} />}
      {tab==='invoices'  && <InvoicesTab />}
      {tab==='rules'     && <RulesTab spaces={spaces} />}
    </div>
  )
}
