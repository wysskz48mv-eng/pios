'use client'
import { useState, useEffect, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Consulting v3.0 — CSA™ Consulting Strategist Agent
// 15 NemoClaw™ proprietary frameworks · Engagement CRUD · Proposal generator
// UIX fully upgraded to v3.0 token set (no Tailwind dependencies)
// PIOS v3.0 · VeritasIQ Technologies Ltd
// ─────────────────────────────────────────────────────────────────────────────

type Framework  = { key:string; name:string; desc:string }
type Engagement = { id:string; client_name:string; engagement_type:string; status:string; framework_used:string; brief:string; ai_output:string; created_at:string }

const STATUS_COLOR: Record<string,string> = {
  active:'var(--fm)', proposal:'var(--academic)', on_hold:'var(--saas)',
  completed:'var(--pios-dim)', cancelled:'var(--dng)',
}
const ENG_TYPES = ['strategy','operations','change','commercial','diagnostic','other']

const inp: React.CSSProperties = {
  display:'block', width:'100%', padding:'9px 12px', marginBottom:10,
  background:'var(--pios-surface2)', border:'1px solid var(--pios-border2)',
  borderRadius:8, color:'var(--pios-text)', fontSize:13,
  fontFamily:'var(--font-sans)', outline:'none', boxSizing:'border-box' as const,
  transition:'border-color 0.15s',
}

function Tag({ children, color }: { children:React.ReactNode; color:string }) {
  return <span style={{ fontSize:9.5, fontWeight:600, padding:'2px 7px', borderRadius:5, background:`${color}12`, color, letterSpacing:'0.02em' }}>{children}</span>
}

function SectionLabel({ children }: { children:React.ReactNode }) {
  return <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:'var(--pios-dim)', marginBottom:10 }}>{children}</div>
}

// ── Framework card ────────────────────────────────────────────────────────────
function FrameworkCard({ fw, selected, onSelect }: { fw:Framework; selected:boolean; onSelect:()=>void }) {
  return (
    <button onClick={onSelect} style={{
      background:selected?'var(--ai-subtle)':'var(--pios-surface)',
      border:`1px solid ${selected?'var(--ai)':'var(--pios-border)'}`,
      borderRadius:10, padding:'12px 14px', cursor:'pointer', textAlign:'left' as const,
      transition:'all 0.15s', fontFamily:'var(--font-sans)', width:'100%',
    }}
      onMouseEnter={e=>{ if(!selected)(e.currentTarget as HTMLButtonElement).style.borderColor='var(--pios-border2)' }}
      onMouseLeave={e=>{ if(!selected)(e.currentTarget as HTMLButtonElement).style.borderColor='var(--pios-border)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
        <span style={{ fontFamily:'var(--font-display)', fontSize:11.5, fontWeight:800, color:selected?'var(--ai)':'var(--pios-muted)', letterSpacing:'0.02em' }}>{fw.key}</span>
        {selected && <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--ai)' }} />}
      </div>
      <div style={{ fontSize:12, fontWeight:600, color:'var(--pios-text)', marginBottom:3, lineHeight:1.3 }}>{fw.name}</div>
      <div style={{ fontSize:11, color:'var(--pios-muted)', lineHeight:1.5 }}>{fw.desc}</div>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ConsultingPage() {
  const [frameworks,    setFrameworks]    = useState<Framework[]>([])
  const [engagements,   setEngagements]   = useState<Engagement[]>([])
  const [loading,       setLoading]       = useState(true)
  const [activeTab,     setActiveTab]     = useState<'frameworks'|'engagements'|'proposals'>('frameworks')

  // Framework analyser
  const [selFramework,  setSelFramework]  = useState('')
  const [situation,     setSituation]     = useState('')
  const [engagementId,  setEngagementId]  = useState('')
  const [analysing,     setAnalysing]     = useState(false)
  const [analysis,      setAnalysis]      = useState<string|null>(null)
  const [copied,        setCopied]        = useState(false)

  // Proposal generator
  const [propClient,    setPropClient]    = useState('')
  const [propType,      setPropType]      = useState('strategy')
  const [propScope,     setPropScope]     = useState('')
  const [generating,    setGenerating]    = useState(false)
  const [proposal,      setProposal]      = useState<string|null>(null)

  // Engagement modal
  const [showEngModal,  setShowEngModal]  = useState(false)
  const [engForm,       setEngForm]       = useState({ client_name:'', engagement_type:'strategy', status:'active', brief:'' })
  const [saving,        setSaving]        = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fwRes, engRes] = await Promise.all([
        fetch('/api/consulting?mode=frameworks'),
        fetch('/api/consulting'),
      ])
      const [fwData, engData] = await Promise.all([fwRes.json(), engRes.json()])
      setFrameworks(fwData.frameworks ?? [])
      setEngagements(engData.engagements ?? [])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function runAnalysis() {
    if (!selFramework || !situation.trim()) return
    setAnalysing(true); setAnalysis(null)
    try {
      const r = await fetch('/api/consulting', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'apply_framework', framework_key:selFramework, situation:situation.trim(), engagement_id:engagementId||undefined }),
      })
      const d = await r.json()
      setAnalysis(d.analysis ?? 'No output returned.')
    } catch { setAnalysis('Error generating analysis. Please try again.') }
    setAnalysing(false)
  }

  async function generateProposal() {
    if (!propClient.trim() || !propScope.trim()) return
    setGenerating(true); setProposal(null)
    try {
      const r = await fetch('/api/consulting', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'generate_proposal', client_name:propClient, engagement_type:propType, scope:propScope }),
      })
      const d = await r.json()
      setProposal(d.proposal ?? 'Error generating proposal.')
    } catch { setProposal('Error generating proposal. Please try again.') }
    setGenerating(false)
  }

  async function saveEngagement() {
    setSaving(true)
    await fetch('/api/consulting', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ action:'save_engagement', payload:engForm }),
    })
    setShowEngModal(false)
    setEngForm({ client_name:'', engagement_type:'strategy', status:'active', brief:'' })
    setSaving(false); load()
  }

  function copyAnalysis() {
    if (!analysis) return
    navigator.clipboard.writeText(analysis)
    setCopied(true); setTimeout(()=>setCopied(false), 2000)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:240, color:'var(--pios-muted)', fontSize:13 }}>
      <div style={{ width:14, height:14, border:'2px solid var(--pios-border2)', borderTop:'2px solid var(--ai)', borderRadius:'50%', animation:'spin 0.8s linear infinite', marginRight:10 }} />
      Loading Consulting Engine…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const selFw = frameworks.find(f=>f.key===selFramework)

  return (
    <div className="fade-up">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:400, color:'var(--pios-text)', letterSpacing:'-0.03em' }}>Consulting Strategist</h1>
            <Tag color="var(--ai)">CSA™</Tag>
          </div>
          <p style={{ fontSize:12, color:'var(--pios-muted)' }}>
            {frameworks.length} proprietary frameworks · {engagements.length} active engagements
          </p>
        </div>
        <button onClick={()=>setShowEngModal(true)} style={{ padding:'7px 16px', borderRadius:9, border:'none', background:'var(--ai)', color:'#fff', fontFamily:'var(--font-sans)', fontSize:13, fontWeight:400, cursor:'pointer' }}>
          + New Engagement
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, padding:3, borderRadius:9, background:'var(--pios-surface2)', marginBottom:22, width:'fit-content' }}>
        {([['frameworks','Framework Engine'],['engagements','Engagements'],['proposals','Proposal Generator']] as const).map(([tab, label]) => (
          <button key={tab} onClick={()=>setActiveTab(tab)} style={{
            padding:'6px 16px', borderRadius:7, border:'none', cursor:'pointer',
            background:activeTab===tab?'var(--ai-subtle)':'transparent',
            color:activeTab===tab?'var(--ai)':'var(--pios-muted)',
            fontSize:12.5, fontWeight:activeTab===tab?600:400,
            fontFamily:'var(--font-sans)', transition:'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── TAB: Framework Engine ── */}
      {activeTab==='frameworks' && (
        <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20 }}>

          {/* Framework selector */}
          <div>
            <SectionLabel>Select Framework</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {frameworks.map(fw => (
                <FrameworkCard key={fw.key} fw={fw} selected={selFramework===fw.key} onSelect={()=>setSelFramework(fw.key)} />
              ))}
              {frameworks.length === 0 && (
                <div style={{ padding:'24px', textAlign:'center', color:'var(--pios-muted)', fontSize:12, border:'1px dashed var(--pios-border)', borderRadius:10 }}>
                  No frameworks loaded.<br/>Check NemoClaw™ seed in admin.
                </div>
              )}
            </div>
          </div>

          {/* Analysis panel */}
          <div>
            {selFw ? (
              <>
                {/* Selected framework header */}
                <div style={{ background:'var(--ai-subtle)', border:'1px solid rgba(139,124,248,0.2)', borderRadius:12, padding:'14px 16px', marginBottom:16, position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg, var(--ai), var(--academic))' }} />
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontFamily:'var(--font-display)', fontSize:13, fontWeight:800, color:'var(--ai)' }}>{selFw.key}™</span>
                    <span style={{ fontFamily:'var(--font-display)', fontSize:14, fontWeight:400, color:'var(--pios-text)', letterSpacing:'-0.01em' }}>{selFw.name}</span>
                  </div>
                  <div style={{ fontSize:12.5, color:'var(--pios-muted)', lineHeight:1.55 }}>{selFw.desc}</div>
                </div>

                {/* Situation input */}
                <SectionLabel>Describe your situation</SectionLabel>
                <textarea
                  style={{ ...inp, resize:'vertical', fontFamily:'inherit', minHeight:120, marginBottom:12 }}
                  placeholder={`Describe the situation you want to analyse using ${selFw.key}™. Include context, stakeholders, constraints, and what decision or output you need…`}
                  value={situation} onChange={e=>setSituation(e.target.value)}
                  onFocus={e=>{ (e.target as HTMLTextAreaElement).style.borderColor='var(--ai)' }}
                  onBlur={e=>{ (e.target as HTMLTextAreaElement).style.borderColor='var(--pios-border2)' }}
                />

                {/* Link to engagement */}
                {engagements.length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <SectionLabel>Link to engagement (optional)</SectionLabel>
                    <select style={inp} value={engagementId} onChange={e=>setEngagementId(e.target.value)}>
                      <option value="">— No engagement —</option>
                      {engagements.filter(e=>e.status==='active'||e.status==='proposal').map(e=>(
                        <option key={e.id} value={e.id}>{e.client_name} · {e.engagement_type}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button onClick={runAnalysis} disabled={analysing||!situation.trim()} style={{
                  padding:'10px 20px', borderRadius:9, border:'none',
                  background:analysing||!situation.trim()?'rgba(139,124,248,0.3)':'var(--ai)',
                  color:'#fff', fontFamily:'var(--font-display)', fontSize:13, fontWeight:400,
                  cursor:analysing||!situation.trim()?'not-allowed':'pointer', transition:'opacity 0.15s',
                  display:'flex', alignItems:'center', gap:8,
                }}>
                  {analysing ? (
                    <><div style={{ width:13, height:13, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /> Analysing…</>
                  ) : `Apply ${selFw.key}™ →`}
                </button>

                {/* Analysis output */}
                {analysis && (
                  <div style={{ marginTop:18, background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, overflow:'hidden' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--pios-border)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--ai)' }} className="ai-pulse" />
                        <span style={{ fontFamily:'var(--font-display)', fontSize:12.5, fontWeight:400, color:'var(--pios-text)' }}>{selFw.key}™ Analysis</span>
                      </div>
                      <button onClick={copyAnalysis} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--pios-border2)', background:'transparent', color:'var(--pios-muted)', fontSize:11, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                        {copied?'✓ Copied':'⎘ Copy'}
                      </button>
                    </div>
                    <div style={{ padding:'16px', fontSize:13, lineHeight:1.75, color:'var(--pios-text)', whiteSpace:'pre-wrap', maxHeight:480, overflowY:'auto' }}>
                      {analysis}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:320, textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:14, opacity:0.25 }}>◎</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:15, fontWeight:400, color:'var(--pios-text)', marginBottom:6 }}>Select a framework</div>
                <p style={{ fontSize:13, color:'var(--pios-muted)', maxWidth:340, lineHeight:1.65 }}>
                  Choose one of the {frameworks.length} NemoClaw™ proprietary frameworks from the left, describe your situation, and get a structured strategic analysis.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Engagements ── */}
      {activeTab==='engagements' && (
        <div>
          {engagements.length===0 ? (
            <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:14, padding:'52px 24px', textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:12, opacity:0.25 }}>◎</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:15, fontWeight:400, marginBottom:8 }}>No engagements yet</div>
              <p style={{ fontSize:13, color:'var(--pios-muted)', marginBottom:18 }}>Track your consulting engagements and link framework analyses to client work.</p>
              <button onClick={()=>setShowEngModal(true)} style={{ padding:'8px 18px', borderRadius:9, border:'none', background:'var(--ai)', color:'#fff', fontFamily:'var(--font-sans)', fontSize:13, fontWeight:400, cursor:'pointer' }}>+ New Engagement</button>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {engagements.map(e=>(
                <div key={e.id} style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, padding:'14px 16px', borderLeft:`2px solid ${STATUS_COLOR[e.status]??'var(--pios-dim)'}` }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ fontFamily:'var(--font-display)', fontSize:13.5, fontWeight:400, color:'var(--pios-text)', letterSpacing:'-0.01em' }}>{e.client_name}</div>
                    <Tag color={STATUS_COLOR[e.status]??'var(--pios-dim)'}>{e.status.replace('_',' ')}</Tag>
                  </div>
                  <div style={{ display:'flex', gap:5, marginBottom:8, flexWrap:'wrap' }}>
                    <Tag color="var(--pios-muted)">{e.engagement_type}</Tag>
                    {e.framework_used&&<Tag color="var(--ai)">{e.framework_used}</Tag>}
                  </div>
                  {e.brief&&<p style={{ fontSize:11.5, color:'var(--pios-muted)', lineHeight:1.55 }}>{e.brief.slice(0,100)}{e.brief.length>100?'…':''}</p>}
                  <div style={{ fontSize:10, color:'var(--pios-dim)', marginTop:8 }}>
                    {new Date(e.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Proposal Generator ── */}
      {activeTab==='proposals' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div>
            <SectionLabel>Client &amp; scope</SectionLabel>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:'var(--pios-dim)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:5 }}>Client name</div>
              <input style={inp} placeholder="Acme Corp / QPMO / KSP…" value={propClient} onChange={e=>setPropClient(e.target.value)}
                onFocus={e=>{(e.target as HTMLInputElement).style.borderColor='var(--ai)'}}
                onBlur={e=>{(e.target as HTMLInputElement).style.borderColor='var(--pios-border2)'}} />
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:'var(--pios-dim)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:5 }}>Engagement type</div>
              <select style={inp} value={propType} onChange={e=>setPropType(e.target.value)}>
                {ENG_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, color:'var(--pios-dim)', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:5 }}>Scope &amp; requirements</div>
              <textarea
                style={{ ...inp, resize:'vertical', fontFamily:'inherit', minHeight:120 }}
                placeholder="Describe what the client needs, the key challenges, deliverables expected, and any constraints…"
                value={propScope} onChange={e=>setPropScope(e.target.value)}
                onFocus={e=>{(e.target as HTMLTextAreaElement).style.borderColor='var(--ai)'}}
                onBlur={e=>{(e.target as HTMLTextAreaElement).style.borderColor='var(--pios-border2)'}}
              />
            </div>
            <button onClick={generateProposal} disabled={generating||!propClient.trim()||!propScope.trim()} style={{
              padding:'10px 20px', borderRadius:9, border:'none',
              background:generating||!propClient.trim()||!propScope.trim()?'rgba(139,124,248,0.3)':'var(--ai)',
              color:'#fff', fontFamily:'var(--font-display)', fontSize:13, fontWeight:400,
              cursor:generating||!propClient.trim()||!propScope.trim()?'not-allowed':'pointer',
              display:'flex', alignItems:'center', gap:8,
            }}>
              {generating?(
                <><div style={{ width:13, height:13, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />Generating…</>
              ):'Generate Proposal →'}
            </button>
          </div>

          <div>
            {proposal ? (
              <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border)', borderRadius:12, overflow:'hidden', height:'100%' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--pios-border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--ai)' }} className="ai-pulse" />
                    <span style={{ fontFamily:'var(--font-display)', fontSize:12.5, fontWeight:400 }}>Proposal — {propClient}</span>
                  </div>
                  <button onClick={()=>{navigator.clipboard.writeText(proposal||'');setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--pios-border2)', background:'transparent', color:'var(--pios-muted)', fontSize:11, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                    {copied?'✓ Copied':'⎘ Copy'}
                  </button>
                </div>
                <div style={{ padding:'16px', fontSize:13, lineHeight:1.75, color:'var(--pios-text)', whiteSpace:'pre-wrap', overflowY:'auto', maxHeight:480 }}>
                  {proposal}
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', textAlign:'center', border:'1px dashed var(--pios-border)', borderRadius:12, padding:32 }}>
                <div style={{ fontSize:28, marginBottom:12, opacity:0.2 }}>◎</div>
                <div style={{ fontSize:13, color:'var(--pios-muted)', lineHeight:1.65 }}>
                  Fill in the client details and scope, then generate a structured consulting proposal using NemoClaw™ intelligence.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Engagement modal */}
      {showEngModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20 }}>
          <div style={{ background:'var(--pios-surface)', border:'1px solid var(--pios-border2)', borderRadius:16, padding:28, width:'100%', maxWidth:440, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg, var(--ai), var(--academic))' }} />
            <div style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:400, color:'var(--pios-text)', letterSpacing:'-0.02em', marginBottom:18 }}>New Engagement</div>

            {[
              { label:'Client name', key:'client_name', type:'text', placeholder:'QPMO / KSP / Acme Corp' },
            ].map(field=>(
              <div key={field.key} style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, color:'var(--pios-dim)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>{field.label}</div>
                <input style={inp} placeholder={field.placeholder} value={(engForm as any)[field.key]} onChange={e=>setEngForm(f=>({...f,[field.key]:e.target.value}))}
                  onFocus={ev=>{(ev.target as HTMLInputElement).style.borderColor='var(--ai)'}}
                  onBlur={ev=>{(ev.target as HTMLInputElement).style.borderColor='var(--pios-border2)'}} />
              </div>
            ))}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
              <div>
                <div style={{ fontSize:10, color:'var(--pios-dim)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>Type</div>
                <select style={inp} value={engForm.engagement_type} onChange={e=>setEngForm(f=>({...f,engagement_type:e.target.value}))}>
                  {ENG_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:10, color:'var(--pios-dim)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>Status</div>
                <select style={inp} value={engForm.status} onChange={e=>setEngForm(f=>({...f,status:e.target.value}))}>
                  {['active','proposal','on_hold','completed','cancelled'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, color:'var(--pios-dim)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>Brief description</div>
              <textarea style={{ ...inp, resize:'vertical', fontFamily:'inherit', minHeight:72 }} placeholder="Scope, objectives, key deliverables…" value={engForm.brief} onChange={e=>setEngForm(f=>({...f,brief:e.target.value}))}
                onFocus={ev=>{(ev.target as HTMLTextAreaElement).style.borderColor='var(--ai)'}}
                onBlur={ev=>{(ev.target as HTMLTextAreaElement).style.borderColor='var(--pios-border2)'}} />
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setShowEngModal(false)} style={{ flex:1, padding:'10px', borderRadius:9, border:'1px solid var(--pios-border2)', background:'transparent', color:'var(--pios-muted)', fontSize:13, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Cancel</button>
              <button onClick={saveEngagement} disabled={!engForm.client_name||saving} style={{ flex:2, padding:'10px', borderRadius:9, border:'none', background:!engForm.client_name||saving?'rgba(139,124,248,0.35)':'var(--ai)', color:'#fff', fontFamily:'var(--font-display)', fontSize:13, fontWeight:400, cursor:!engForm.client_name||saving?'not-allowed':'pointer' }}>
                {saving?'Saving…':'Save Engagement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
