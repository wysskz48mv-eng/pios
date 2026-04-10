// @ts-nocheck
'use client'
// PIOS™ v3.4.1 | Sprint J — Privacy & GDPR Dashboard | VeritasIQ Technologies Ltd
import { useState, useEffect } from 'react'
import { Shield, Download, Trash2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

interface GDPRInfo { articles:Record<string,string>; rights:Record<string,string>; tables:string[] }

export default function PrivacyPage() {
  const [info,        setInfo]        = useState<GDPRInfo|null>(null)
  const [loading,     setLoading]     = useState(true)
  const [exportLoad,  setExportLoad]  = useState(false)
  const [exportData,  setExportData]  = useState<any>(null)
  const [eraseLoad,   setEraseLoad]   = useState(false)
  const [eraseResult, setEraseResult] = useState<any>(null)
  const [eraseConf,   setEraseConf]   = useState('')
  const [smartLoad,   setSmartLoad]   = useState(false)
  const [digest,      setDigest]      = useState<string|null>(null)
  const [smartResult, setSmartResult] = useState<any>(null)
  const [tab,         setTab]         = useState<'overview'|'export'|'notifications'|'erase'>('overview')

  useEffect(() => {
    fetch('/api/gdpr').then(r=>r.json()).then(d => {
      setInfo(d); setLoading(false)
    })
  }, [])

  async function exportData_() {
    setExportLoad(true); setExportData(null)
    try {
      const r = await fetch('/api/gdpr', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'export'})})
      const d = await r.json()
      setExportData(d)
    } catch (err) { console.error('[PIOS]', err) }
    setExportLoad(false)
  }

  async function eraseWellness() {
    setEraseLoad(true)
    try {
      const r = await fetch('/api/gdpr', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'erase_wellness'})})
      const d = await r.json()
      setEraseResult({...d, type:'wellness'})
    } catch (err) { console.error('[PIOS]', err) }
    setEraseLoad(false)
  }

  async function eraseAll() {
    if (eraseConf !== 'ERASE MY DATA') return
    setEraseLoad(true)
    try {
      const r = await fetch('/api/gdpr', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'erase',confirm:'ERASE MY DATA'})})
      const d = await r.json()
      setEraseResult({...d, type:'full'})
    } catch (err) { console.error('[PIOS]', err) }
    setEraseLoad(false)
  }

  async function genSmartNotifs() {
    setSmartLoad(true); setSmartResult(null); setDigest(null)
    try {
      const r = await fetch('/api/notifications/smart', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate'})})
      const d = await r.json()
      setSmartResult(d)
      if (d.notifications?.length) {
        const dr = await fetch('/api/notifications/smart', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'digest',notifications:d.notifications})})
        const dd = await dr.json()
        setDigest(dd.digest ?? null)
      }
    } catch (err) { console.error('[PIOS]', err) }
    setSmartLoad(false)
  }

  const C = {navy:'#0D2B52',teal:'#0A7A7A',gold:'#C9A84C'}
  const card = {background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:12,padding:'16px 18px',marginBottom:10} as const
  const inp  = {width:'100%',padding:'8px 12px',borderRadius:8,border:'0.5px solid var(--color-border-secondary)',background:'var(--color-background-secondary)',color:'var(--color-text-primary)',fontSize:13,fontFamily:'inherit'} as const
  const btn  = (bg:string,col:string='#fff') => ({borderRadius:8,border:'none',background:bg,color:col,padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:6} as const)

  return (
    <div style={{fontFamily:'var(--font-sans,system-ui)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
        <Shield size={20} color={C.navy}/>
        <div>
          <h1 style={{fontSize:18,fontWeight:500,color:'var(--color-text-primary)',margin:0}}>Privacy & GDPR</h1>
          <p style={{fontSize:12,color:'var(--color-text-tertiary)',marginTop:2}}>Your data rights · GDPR compliance · Smart notifications</p>
          <p style={{fontSize:11,color:'var(--color-text-tertiary)',marginTop:4}}>ICO registration application filed on 8 April 2026 · reference C1903482</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:2,borderBottom:'0.5px solid var(--color-border-tertiary)',marginBottom:18}}>
        {([['overview','Overview'],['export','Export data'],['notifications','Smart notifications'],['erase','Data erasure']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{...btn('transparent',tab===k?C.navy:'var(--color-text-secondary)'),borderRadius:'6px 6px 0 0',borderBottom:tab===k?`2px solid ${C.navy}`:'2px solid transparent',paddingBottom:10}}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'2rem',color:'var(--color-text-tertiary)',fontSize:13}}><Loader2 size={16}/> Loading…</div>
      ) : (<>

        {/* Overview tab */}
        {tab==='overview'&&info&&(
          <div>
            <div style={{...card,borderLeft:`3px solid ${C.navy}`,marginBottom:16}}>
              <p style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)',marginBottom:8}}>Your PIOS data rights</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {Object.entries(info.rights ?? {}).map(([right,desc])=>(
                  <div key={right} style={{padding:'10px 12px',borderRadius:8,background:'var(--color-background-secondary)'}}>
                    <p style={{fontSize:12,fontWeight:500,color:'var(--color-text-primary)',marginBottom:3}}>{right}</p>
                    <p style={{fontSize:11,color:'var(--color-text-tertiary)',lineHeight:1.5}}>{String(desc)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={card}>
              <p style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)',marginBottom:10}}>Data stored in PIOS</p>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {(info.tables ?? []).map((t:string)=>(
                  <span key={t} style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:'var(--color-background-secondary)',color:'var(--color-text-secondary)',fontFamily:'var(--font-mono,monospace)'}}>{t}</span>
                ))}
              </div>
              <p style={{fontSize:11,color:'var(--color-text-tertiary)',marginTop:10,lineHeight:1.5}}>
                All data is stored in your personal Supabase partition with Row Level Security — only you can access your data.
                Wellness data is classified as GDPR Art.9 special category health data.
              </p>
            </div>
          </div>
        )}

        {/* Export tab */}
        {tab==='export'&&(
          <div>
            <div style={card}>
              <p style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)',marginBottom:8}}>Export your data (Art.20 GDPR)</p>
              <p style={{fontSize:12,color:'var(--color-text-tertiary)',lineHeight:1.6,marginBottom:14}}>
                Download a complete copy of all your PIOS data in machine-readable JSON format.
                Includes: insights, tasks, meetings, thesis chapters, literature, IP assets, and preferences.
              </p>
              <button onClick={exportData_} disabled={exportLoad} style={{...btn(C.navy),opacity:exportLoad?0.5:1}}>
                {exportLoad?<><Loader2 size={12}/>Exporting…</>:<><Download size={12}/>Export my data</>}
              </button>
            </div>
            {exportData && (
              <div style={{...card,background:'var(--color-background-secondary)'}}>
                <p style={{fontSize:11,fontWeight:500,color:'var(--color-text-primary)',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
                  <CheckCircle2 size={12} color='#22c55e'/> Export complete
                </p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {Object.entries(exportData).filter(([k])=>k!=='ok'&&k!=='action'&&k!=='legal_basis'&&k!=='exported_at').map(([k,v])=>(
                    <div key={k} style={{padding:'8px 12px',borderRadius:6,background:'var(--color-background-primary)'}}>
                      <p style={{fontSize:10,color:'var(--color-text-tertiary)',marginBottom:2}}>{k}</p>
                      <p style={{fontSize:12,fontWeight:500,color:'var(--color-text-primary)'}}>{Array.isArray(v)?`${(v as any[]).length} records`:typeof v==='object'?JSON.stringify(v).slice(0,40)+'…':String(v).slice(0,40)}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={()=>{const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`pios-data-export-${new Date().toISOString().slice(0,10)}.json`;a.click()}}
                  style={{...btn(C.gold,'#0B0F1A'),marginTop:12}}>
                  <Download size={12}/> Download JSON
                </button>
              </div>
            )}
          </div>
        )}

        {/* Smart notifications tab */}
        {tab==='notifications'&&(
          <div>
            <div style={card}>
              <p style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)',marginBottom:8}}>Smart Notification Engine</p>
              <p style={{fontSize:12,color:'var(--color-text-tertiary)',lineHeight:1.6,marginBottom:14}}>
                Scans your PIOS state (tasks, IP renewals, DBA chapters, agent runs) and generates AI-prioritised alerts.
                Uses Claude Haiku 4.5 for speed. Runs daily at 07:00 UTC via CRON.
              </p>
              <button onClick={genSmartNotifs} disabled={smartLoad} style={{...btn(C.navy),opacity:smartLoad?0.5:1}}>
                {smartLoad?<><Loader2 size={12}/>Scanning…</>:'⚡ Generate smart notifications'}
              </button>
            </div>
            {smartResult && (<>
              {digest && (
                <div style={{...card,borderLeft:`3px solid ${C.gold}`,background:`${C.gold}08`,marginBottom:12}}>
                  <p style={{fontSize:11,fontWeight:500,color:C.gold,marginBottom:8}}>MORNING DIGEST</p>
                  <pre style={{whiteSpace:'pre-wrap',fontSize:13,lineHeight:1.75,fontFamily:'inherit',margin:0,color:'var(--color-text-primary)'}}>{digest}</pre>
                </div>
              )}
              <div style={card}>
                <p style={{fontSize:11,fontWeight:500,color:'var(--color-text-tertiary)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
                  {smartResult.generated} notifications generated
                </p>
                {smartResult.notifications?.map((n:any,i:number)=>(
                  <div key={i} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:'0.5px solid var(--color-border-tertiary)',alignItems:'flex-start'}}>
                    <span style={{fontSize:14,flexShrink:0,marginTop:2}}>
                      {n.type==='urgent'?'🔴':n.type==='warning'?'🟡':n.type==='academic'?'🎓':n.type==='ip'?'⚖':n.type==='agent'?'🤖':'🔵'}
                    </span>
                    <div style={{flex:1}}>
                      <p style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)',marginBottom:2}}>{n.title}</p>
                      <p style={{fontSize:12,color:'var(--color-text-secondary)',lineHeight:1.5}}>{n.body}</p>
                    </div>
                    {n.action_url&&<a href={n.action_url} style={{fontSize:11,color:'var(--color-text-info)',whiteSpace:'nowrap',marginTop:2}}>→ View</a>}
                  </div>
                ))}
                {smartResult.state_summary&&(
                  <div style={{display:'flex',gap:16,fontSize:11,color:'var(--color-text-tertiary)',marginTop:12,flexWrap:'wrap'}}>
                    <span>Overdue tasks: <strong>{smartResult.state_summary.overdue}</strong></span>
                    <span>Due this week: <strong>{smartResult.state_summary.due_soon}</strong></span>
                    <span>IP renewals: <strong>{smartResult.state_summary.ip_renewals}</strong></span>
                    <span>DBA progress: <strong>{smartResult.state_summary.dba_progress_pct}%</strong></span>
                  </div>
                )}
              </div>
            </>)}
          </div>
        )}

        {/* Erase tab */}
        {tab==='erase'&&(
          <div>
            <div style={{...card,borderLeft:'3px solid #f59e0b'}}>
              <p style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
                <AlertCircle size={14} color='#f59e0b'/> Wellness data erasure (Art.17 GDPR)
              </p>
              <p style={{fontSize:12,color:'var(--color-text-tertiary)',lineHeight:1.6,marginBottom:14}}>
                Wellness data is classified as GDPR Art.9 special category health data.
                You can erase it independently without affecting your other PIOS data.
              </p>
              <button onClick={eraseWellness} disabled={eraseLoad} style={{...btn('#f59e0b','#1a1000'),opacity:eraseLoad?0.5:1}}>
                {eraseLoad?<><Loader2 size={12}/>Erasing…</>:'Erase wellness data'}
              </button>
            </div>
            <div style={{...card,borderLeft:'3px solid #ef4444'}}>
              <p style={{fontSize:13,fontWeight:500,color:'#b91c1c',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
                <Trash2 size={14}/> Full account erasure (Art.17 GDPR)
              </p>
              <p style={{fontSize:12,color:'var(--color-text-tertiary)',lineHeight:1.6,marginBottom:14}}>
                Permanently deletes all your PIOS data and pseudonymises your profile.
                This cannot be undone. Type <strong>ERASE MY DATA</strong> to confirm.
              </p>
              <input value={eraseConf} onChange={e=>setEraseConf(e.target.value)}
                placeholder="Type ERASE MY DATA to confirm" style={{...inp,marginBottom:10,borderColor:'#fca5a5'}}/>
              <button onClick={eraseAll} disabled={eraseLoad||eraseConf!=='ERASE MY DATA'}
                style={{...btn('#ef4444'),opacity:eraseLoad||eraseConf!=='ERASE MY DATA'?0.3:1}}>
                {eraseLoad?<><Loader2 size={12}/>Erasing…</>:<><Trash2 size={12}/>Permanently erase all data</>}
              </button>
            </div>
            {eraseResult&&(
              <div style={{...card,borderLeft:`3px solid ${eraseResult.ok?'#22c55e':'#ef4444'}`,background:'var(--color-background-secondary)'}}>
                <p style={{fontSize:12,fontWeight:500,color:eraseResult.ok?'#15803d':'#b91c1c',marginBottom:6,display:'flex',alignItems:'center',gap:6}}>
                  <CheckCircle2 size={12}/> {eraseResult.type==='wellness'?'Wellness data erased':'All data erased'}
                </p>
                <p style={{fontSize:11,color:'var(--color-text-tertiary)'}}>{eraseResult.legal_basis}</p>
              </div>
            )}
          </div>
        )}
      </>)}
    </div>
  )
}
