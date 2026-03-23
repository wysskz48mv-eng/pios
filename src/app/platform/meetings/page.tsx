'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { domainColour, domainLabel } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Meetings — Notes Ingestion + AI Action Extraction (Otter.ai gap closed)
// Paste transcripts or type notes → AI extracts decisions, action items, risks
// Promote action items directly to Tasks with one click
// PIOS v2.2 | VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT  = '#a78bfa'
const TYPES   = ['general','supervision','board','client','team','interview','consultation','viva','review','one_on_one','other']
const DOMAINS = ['academic','fm_consulting','saas','business','personal']
const PLATFORMS = ['zoom','teams','meet','in_person','phone','other']

const TYPE_LABELS: Record<string,string> = {
  general:'General', supervision:'Supervision', board:'Board', client:'Client',
  team:'Team', interview:'Interview', consultation:'Consultation', viva:'Viva',
  review:'Review', one_on_one:'1:1', other:'Other',
}

function Badge({ label, colour }: { label: string; colour: string }) {
  return (
    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:colour+'20', color:colour, fontWeight:600, whiteSpace:'nowrap' as const }}>
      {label}
    </span>
  )
}

function PriorityDot({ p }: { p: string }) {
  const c = p==='critical'?'#ef4444':p==='high'?'#f97316':p==='medium'?'#eab308':'#22c55e'
  return <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:c, marginRight:5 }} />
}

export default function MeetingsPage() {
  const [meetings,   setMeetings]   = useState<unknown[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<unknown>(null)
  const [showNew,    setShowNew]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [processing, setProcessing] = useState(false)
  const [promoting,  setPromoting]  = useState(false)
  const [filter,     setFilter]     = useState('all')
  const [selectedItems, setSelectedItems] = useState<number[]>([])

  const EMPTY_FORM = {
    title:'', meeting_date:new Date().toISOString().slice(0,10), duration_mins:'',
    attendees:'', meeting_type:'general', domain:'business', platform:'',
    raw_transcript:'', raw_notes:'', auto_process:true,
  }
  const [form, setForm] = useState(EMPTY_FORM)

  // Prefill from calendar deep-link (?prefill=title&date=YYYY-MM-DD)
  const searchParams = useSearchParams()
  useEffect(() => {
    const prefill = searchParams.get('prefill')
    const date    = searchParams.get('date')
    if (prefill || date) {
      setForm(p => ({
        ...p,
        title:        prefill ? decodeURIComponent(prefill) : p.title,
        meeting_date: date ?? p.meeting_date,
      }))
      setShowNew(true)
    }
  }, [searchParams])


  const load = useCallback(async () => {
    setLoading(true)
    const qs = filter !== 'all' ? `?domain=${filter}` : ''
    const res = await fetch(`/api/meetings${qs}`)
    if (res.ok) { const d = await res.json(); setMeetings(d.meetings ?? []) }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function create() {
    if (!form.title.trim()) return
    setSaving(true)
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        duration_mins: form.duration_mins ? parseInt(form.duration_mins) : null,
        attendees: form.attendees ? form.attendees.split(',').map((s:string) => s.trim()).filter(Boolean) : [],
        auto_process: form.auto_process && !!(form.raw_transcript || form.raw_notes),
      }),
    })
    if (res.ok) {
      const { meeting } = await res.json()
      setShowNew(false)
      setForm(EMPTY_FORM)
      await load()
      setSelected(meeting)
    }
    setSaving(false)
  }

  async function processNotes(id: string) {
    setProcessing(true)
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'process', id }),
    })
    if (res.ok) { const { meeting } = await res.json(); setSelected(meeting); await load() }
    setProcessing(false)
  }

  async function promoteTasks(id: string) {
    setPromoting(true)
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'promote_tasks', id,
        selected_items: selectedItems.length > 0 ? selectedItems : undefined,
      }),
    })
    if (res.ok) {
      const { tasks_created } = await res.json()
      await load()
      const updated = meetings.find(m => m.id === id)
      if (updated) setSelected({ ...selected, tasks_created: true })
      alert(`✓ ${tasks_created} task${tasks_created !== 1 ? 's' : ''} created in your task list.`)
    }
    setPromoting(false)
  }

  async function archiveMeeting(id: string) {
    await fetch(`/api/meetings?id=${id}`, { method: 'DELETE' })
    setSelected(null)
    await load()
  }

  const inp: React.CSSProperties = {
    width:'100%', background:'var(--pios-surface2)', border:'1px solid var(--pios-border)',
    borderRadius:6, padding:'7px 10px', color:'var(--pios-text)', fontSize:13, marginBottom:10,
  }
  const sel: React.CSSProperties = { ...inp }

  const actionItems: any[] = selected?.ai_action_items ?? []
  const decisions:   any[] = selected?.ai_decisions    ?? []
  const followUps:   any[] = selected?.ai_follow_ups   ?? []
  const risks:       any[] = selected?.ai_risks        ?? []

  return (
    <div className="fade-in" style={{ color:'var(--pios-text)', height:'calc(100vh - 80px)', display:'flex', flexDirection:'column' as const }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Meetings</h1>
          <p style={{ fontSize:12, color:'var(--pios-muted)' }}>
            Paste transcripts or write notes → AI extracts decisions, action items, and risks
          </p>
        </div>
        <button onClick={() => setShowNew(v => !v)} className="pios-btn pios-btn-primary" style={{ fontSize:12 }}>
          + New meeting
        </button>
      </div>

      <div style={{ flex:1, display:'grid', gridTemplateColumns:'300px 1fr', gap:16, minHeight:0 }}>

        {/* LEFT — list */}
        <div style={{ display:'flex', flexDirection:'column' as const, minHeight:0 }}>

          {/* Domain filter */}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' as const, marginBottom:12, flexShrink:0 }}>
            {['all',...DOMAINS].map(d => (
              <button key={d} onClick={() => setFilter(d)} style={{
                padding:'4px 10px', borderRadius:20, fontSize:10, border:'none', cursor:'pointer',
                background: filter===d ? (d==='all'?ACCENT:domainColour(d)) : 'var(--pios-surface2)',
                color: filter===d ? '#fff' : 'var(--pios-muted)', fontWeight: filter===d ? 600 : 400,
              }}>{d==='all'?'All':domainLabel(d)}</button>
            ))}
          </div>

          {/* New meeting form */}
          {showNew && (
            <div style={{ background:'var(--pios-surface)', border:`1px solid rgba(167,139,250,0.3)`, borderRadius:10, padding:14, marginBottom:12, flexShrink:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:ACCENT, marginBottom:10 }}>New meeting note</div>
              <input style={inp} placeholder="Meeting title *" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <input type="date" style={{ ...inp, marginBottom:0 }} value={form.meeting_date} onChange={e=>setForm(p=>({...p,meeting_date:e.target.value}))} />
                <input type="number" style={{ ...inp, marginBottom:0 }} placeholder="Duration (mins)" value={form.duration_mins} onChange={e=>setForm(p=>({...p,duration_mins:e.target.value}))} />
              </div>
              <div style={{ height:10 }} />
              <select style={sel} value={form.meeting_type} onChange={e=>setForm(p=>({...p,meeting_type:e.target.value}))}>
                {TYPES.map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
              <select style={sel} value={form.domain} onChange={e=>setForm(p=>({...p,domain:e.target.value}))}>
                {DOMAINS.map(d=><option key={d} value={d}>{domainLabel(d)}</option>)}
              </select>
              <input style={inp} placeholder="Attendees (comma-separated)" value={form.attendees} onChange={e=>setForm(p=>({...p,attendees:e.target.value}))} />
              <textarea
                style={{ ...inp, height:80, resize:'vertical' as const, fontFamily:'inherit' }}
                placeholder="Paste transcript here (Zoom, Teams, Meet, Otter export…)"
                value={form.raw_transcript}
                onChange={e=>setForm(p=>({...p,raw_transcript:e.target.value}))}
              />
              <textarea
                style={{ ...inp, height:60, resize:'vertical' as const, fontFamily:'inherit' }}
                placeholder="Or write manual notes"
                value={form.raw_notes}
                onChange={e=>setForm(p=>({...p,raw_notes:e.target.value}))}
              />
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--pios-muted)', marginBottom:10, cursor:'pointer' }}>
                <input type="checkbox" checked={form.auto_process} onChange={e=>setForm(p=>({...p,auto_process:e.target.checked}))} />
                Auto-extract with AI after saving
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={create} disabled={saving} className="pios-btn pios-btn-primary" style={{ fontSize:11 }}>
                  {saving ? 'Saving…' : 'Save & Process'}
                </button>
                <button onClick={() => { setShowNew(false); setForm(EMPTY_FORM) }} className="pios-btn pios-btn-ghost" style={{ fontSize:11 }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Meeting list */}
          <div style={{ flex:1, overflowY:'auto' as const, display:'flex', flexDirection:'column' as const, gap:6 }}>
            {loading ? (
              <p style={{ fontSize:12, color:'var(--pios-muted)', textAlign:'center', padding:'20px 0' }}>Loading…</p>
            ) : meetings.length === 0 ? (
              <p style={{ fontSize:12, color:'var(--pios-dim)', textAlign:'center', padding:'20px 0' }}>
                No meetings yet. Add your first one above.
              </p>
            ) : meetings.map(m => (
              <div key={m.id}
                onClick={() => { setSelected(m); setSelectedItems([]) }}
                style={{
                  padding:'10px 12px', borderRadius:8, cursor:'pointer',
                  background: selected?.id===m.id ? 'var(--pios-surface)' : 'var(--pios-surface2)',
                  border:`1px solid ${selected?.id===m.id ? ACCENT+'50' : 'var(--pios-border)'}`,
                }}>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{m.title}</div>
                <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' as const }}>
                  <span style={{ fontSize:10, color:'var(--pios-muted)' }}>{m.meeting_date}</span>
                  <span style={{ fontSize:9, padding:'1px 6px', borderRadius:10, background: domainColour(m.domain)+'20', color: domainColour(m.domain), fontWeight:600 }}>
                    {domainLabel(m.domain)}
                  </span>
                  {m.status === 'processed' && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:10, background:'rgba(34,197,94,0.12)', color:'#22c55e', fontWeight:600 }}>AI done</span>}
                  {m.tasks_created && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:10, background:'rgba(167,139,250,0.12)', color:ACCENT, fontWeight:600 }}>Tasks ✓</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — detail */}
        <div style={{ overflowY:'auto' as const, background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'20px 22px' }}>
          {!selected ? (
            <div style={{ display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', height:'100%', gap:12, color:'var(--pios-dim)' }}>
              <div style={{ fontSize:36 }}>🗒️</div>
              <p style={{ fontSize:13 }}>Select a meeting or create a new one</p>
              <p style={{ fontSize:11, textAlign:'center' as const, maxWidth:300, lineHeight:1.6 }}>
                Paste a Zoom, Teams, or Google Meet transcript and PIOS will extract decisions, action items, and risks in seconds.
              </p>
            </div>
          ) : (
            <>
              {/* Meeting header */}
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
                <div>
                  <h2 style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{selected.title}</h2>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
                    <span style={{ fontSize:11, color:'var(--pios-muted)' }}>{selected.meeting_date}</span>
                    {selected.duration_mins && <span style={{ fontSize:11, color:'var(--pios-muted)' }}>{selected.duration_mins} mins</span>}
                    <Badge label={TYPE_LABELS[selected.meeting_type] ?? selected.meeting_type} colour={ACCENT} />
                    <Badge label={domainLabel(selected.domain)} colour={domainColour(selected.domain)} />
                    {selected.platform && <Badge label={selected.platform} colour='#64748b' />}
                  </div>
                  {(selected.attendees ?? []).length > 0 && (
                    <div style={{ fontSize:11, color:'var(--pios-muted)', marginTop:4 }}>
                      👥 {selected.attendees.join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  {!selected.ai_processed_at && (selected.raw_transcript || selected.raw_notes) && (
                    <button onClick={() => processNotes(selected.id)} disabled={processing}
                      style={{ padding:'6px 12px', borderRadius:8, border:'none', background:ACCENT, color:'#fff', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                      {processing ? '✦ Processing…' : '✦ Extract with AI'}
                    </button>
                  )}
                  <button onClick={() => archiveMeeting(selected.id)}
                    style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--pios-border)', background:'transparent', cursor:'pointer', color:'var(--pios-muted)', fontSize:11 }}>
                    Archive
                  </button>
                </div>
              </div>

              {/* AI Summary */}
              {selected.ai_summary && (
                <div style={{ padding:'12px 14px', background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:10, marginBottom:16, fontSize:12, lineHeight:1.7, color:'var(--pios-text)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:ACCENT, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>✦ AI Summary</div>
                  {selected.ai_summary}
                </div>
              )}

              {/* Action Items */}
              {actionItems.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ fontSize:12, fontWeight:700 }}>Action Items ({actionItems.length})</div>
                    {!selected.tasks_created && (
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        {selectedItems.length > 0 && (
                          <span style={{ fontSize:10, color:'var(--pios-muted)' }}>{selectedItems.length} selected</span>
                        )}
                        <button onClick={() => promoteTasks(selected.id)} disabled={promoting}
                          style={{ padding:'5px 12px', borderRadius:8, border:`1px solid ${ACCENT}40`, background:`${ACCENT}15`, color:ACCENT, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                          {promoting ? 'Creating…' : `→ Create ${selectedItems.length > 0 ? selectedItems.length : 'all'} task${selectedItems.length !== 1 ? 's' : ''}`}
                        </button>
                      </div>
                    )}
                    {selected.tasks_created && (
                      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(167,139,250,0.12)', color:ACCENT }}>Tasks created ✓</span>
                    )}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
                    {actionItems.map((item: unknown, i: number) => (
                      <label key={i} style={{
                        display:'flex', alignItems:'flex-start', gap:8, padding:'10px 12px',
                        background:'var(--pios-surface2)', borderRadius:8, cursor:'pointer',
                        border:`1px solid ${selectedItems.includes(i) ? ACCENT+'40' : 'var(--pios-border)'}`,
                      }}>
                        {!selected.tasks_created && (
                          <input type="checkbox" checked={selectedItems.includes(i)}
                            onChange={e => setSelectedItems(prev => e.target.checked ? [...prev, i] : prev.filter(x => x !== i))}
                            style={{ marginTop:2, flexShrink:0 }} />
                        )}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:500 }}>
                            <PriorityDot p={item.priority ?? 'medium'} />{item.action ?? item.description}
                          </div>
                          <div style={{ display:'flex', gap:8, marginTop:3 }}>
                            {item.owner && <span style={{ fontSize:10, color:'var(--pios-muted)' }}>→ {item.owner}</span>}
                            {item.due_date && <span style={{ fontSize:10, color:'var(--pios-muted)' }}>Due: {item.due_date}</span>}
                            {item.domain && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:10, background: domainColour(item.domain)+'15', color: domainColour(item.domain) }}>{domainLabel(item.domain)}</span>}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions */}
              {decisions.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>Decisions ({decisions.length})</div>
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:5 }}>
                    {decisions.map((d: unknown, i: number) => (
                      <div key={i} style={{ padding:'8px 12px', background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)', borderRadius:8 }}>
                        <div style={{ fontSize:12 }}>✓ {d.decision}</div>
                        {(d.owner || d.date) && (
                          <div style={{ fontSize:10, color:'var(--pios-muted)', marginTop:2 }}>
                            {d.owner && `Owner: ${d.owner}`}{d.owner && d.date && ' · '}{d.date && `By: ${d.date}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-ups */}
              {followUps.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>Follow-ups ({followUps.length})</div>
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:5 }}>
                    {followUps.map((f: unknown, i: number) => (
                      <div key={i} style={{ padding:'8px 12px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:8 }}>
                        <div style={{ fontSize:12 }}>⟳ {f.topic}</div>
                        {f.context && <div style={{ fontSize:10, color:'var(--pios-muted)', marginTop:2 }}>{f.context}</div>}
                        {f.by_when && <div style={{ fontSize:10, color:'#f59e0b', marginTop:2 }}>By: {f.by_when}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risks */}
              {risks.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>Risks ({risks.length})</div>
                  <div style={{ display:'flex', flexDirection:'column' as const, gap:5 }}>
                    {risks.map((r: unknown, i: number) => (
                      <div key={i} style={{ padding:'8px 12px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:8 }}>
                        <div style={{ fontSize:12 }}>
                          <span style={{ color: r.severity==='high'?'#ef4444':r.severity==='medium'?'#f97316':'#eab308', fontWeight:600, marginRight:4 }}>
                            [{r.severity?.toUpperCase()}]
                          </span>
                          {r.risk}
                        </div>
                        {r.mitigation && <div style={{ fontSize:10, color:'var(--pios-muted)', marginTop:2 }}>↳ {r.mitigation}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No AI output yet */}
              {!selected.ai_processed_at && (
                <div style={{ textAlign:'center' as const, padding:'30px 0', color:'var(--pios-dim)' }}>
                  <p style={{ fontSize:12, marginBottom:8 }}>No AI extraction yet.</p>
                  {(selected.raw_transcript || selected.raw_notes)
                    ? <button onClick={() => processNotes(selected.id)} disabled={processing}
                        style={{ padding:'8px 16px', borderRadius:8, border:'none', background:ACCENT, color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                        {processing ? '✦ Processing…' : '✦ Extract with AI'}
                      </button>
                    : <p style={{ fontSize:11 }}>Add a transcript or notes then click "Extract with AI".</p>
                  }
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
