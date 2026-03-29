'use client'
// PIOS™ v3.4.0 | Sprint I — Background Agents | VeritasIQ Technologies Ltd
import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, Play, Settings, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

interface Agent {
  id:string; name:string; description:string; category:string; icon:string
  schedule:string; actions:string[]; enabled:boolean; config:Record<string,unknown>
  last_run_at:string|null; last_run_status:string; last_run_output:string|null
}

const CAT_COL: Record<string,string> = {
  legal:'#7c3aed', academic:'#2563eb', executive:'#0D2B52',
  technical:'#059669', professional:'#b45309',
}
const STATUS_STYLE: Record<string,{icon:React.ReactNode;col:string}> = {
  success:    {icon:<CheckCircle2 size={12}/>, col:'#22c55e'},
  error:      {icon:<AlertCircle  size={12}/>, col:'#ef4444'},
  never_run:  {icon:<Clock        size={12}/>, col:'#94a3b8'},
  running:    {icon:<Loader2      size={12}/>, col:'#4dabf7'},
}

export default function AgentsPage() {
  const [agents,      setAgents]      = useState<Agent[]>([])
  const [loading,     setLoading]     = useState(true)
  const [running,     setRunning]     = useState<string|null>(null)
  const [runOutput,   setRunOutput]   = useState<Record<string,string>>({})
  const [toggling,    setToggling]    = useState<string|null>(null)
  const [expanded,    setExpanded]    = useState<string|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/agents')
      const d = await r.json()
      setAgents(d.agents ?? [])
    } catch {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function toggle(agentId: string, enabled: boolean) {
    setToggling(agentId)
    try {
      await fetch('/api/agents', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ agent_id: agentId, enabled }),
      })
      setAgents(prev => prev.map(a => a.id===agentId ? {...a,enabled} : a))
    } catch {}
    setToggling(null)
  }

  async function runAgent(agentId: string) {
    setRunning(agentId)
    try {
      const r = await fetch('/api/agents?action=run', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ agent_id: agentId }),
      })
      const d = await r.json()
      if (d.output) {
        setRunOutput(prev => ({...prev, [agentId]: d.output}))
        setExpanded(agentId)
        setAgents(prev => prev.map(a => a.id===agentId ? {
          ...a, last_run_at: new Date().toISOString(), last_run_status:'success', last_run_output: d.output
        } : a))
      }
    } catch {}
    setRunning(null)
  }

  const C = {navy:'#0D2B52',teal:'#0A7A7A',gold:'#C9A84C'}
  const card = {background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:12,padding:'16px 18px',marginBottom:10} as const

  const grouped = ['executive','legal','academic','technical','professional'].map(cat => ({
    cat, agents: agents.filter(a => a.category === cat)
  })).filter(g => g.agents.length > 0)

  return (
    <div style={{fontFamily:'var(--font-sans,system-ui)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:20}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:500,color:'var(--color-text-primary)',margin:0}}>Background Agents</h1>
          <p style={{fontSize:12,color:'var(--color-text-tertiary)',marginTop:4}}>
            Autonomous routines that monitor, alert, and act.
            {agents.filter(a=>a.enabled).length} of {agents.length} agents active.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{borderRadius:8,border:'0.5px solid var(--color-border-secondary)',background:'transparent',color:'var(--color-text-secondary)',padding:'7px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:13}}>
          <RefreshCw size={12}/> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'2rem',color:'var(--color-text-tertiary)',fontSize:13}}>
          <Loader2 size={16}/> Loading agents…
        </div>
      ) : grouped.map(({cat, agents: catAgents}) => (
        <div key={cat} style={{marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:CAT_COL[cat]??'#999'}}/>
            <span style={{fontSize:11,fontWeight:500,color:'var(--color-text-tertiary)',textTransform:'uppercase',letterSpacing:'0.08em'}}>
              {cat}
            </span>
          </div>

          {catAgents.map(agent => {
            const statusStyle = STATUS_STYLE[agent.last_run_status] ?? STATUS_STYLE.never_run
            const output = runOutput[agent.id] ?? agent.last_run_output
            const isExpanded = expanded === agent.id
            return (
              <div key={agent.id} style={{...card,borderLeft:`3px solid ${agent.enabled?CAT_COL[agent.category]:'var(--color-border-tertiary)'}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
                      <span style={{fontSize:18}}>{agent.icon}</span>
                      <span style={{fontSize:14,fontWeight:500,color:'var(--color-text-primary)'}}>{agent.name}</span>
                      <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,
                        background:agent.enabled?`${CAT_COL[agent.category]}18`:'var(--color-background-secondary)',
                        color:agent.enabled?(CAT_COL[agent.category]??'#999'):'var(--color-text-tertiary)',
                        fontWeight:500}}>
                        {agent.enabled?'Active':'Paused'}
                      </span>
                    </div>
                    <p style={{fontSize:12,color:'var(--color-text-secondary)',lineHeight:1.5,marginBottom:6}}>{agent.description}</p>
                    <div style={{display:'flex',gap:12,fontSize:11,color:'var(--color-text-tertiary)',flexWrap:'wrap'}}>
                      <span>⏱ {agent.schedule}</span>
                      {agent.last_run_at && (
                        <span style={{display:'flex',alignItems:'center',gap:4,color:statusStyle.col}}>
                          {statusStyle.icon} {agent.last_run_status} · {new Date(agent.last_run_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                        </span>
                      )}
                      {!agent.last_run_at && <span style={{color:'#94a3b8',display:'flex',alignItems:'center',gap:4}}><Clock size={11}/> Never run</span>}
                    </div>
                  </div>

                  <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
                    {/* Toggle */}
                    <div onClick={()=>toggling!==agent.id&&toggle(agent.id,!agent.enabled)}
                      style={{width:44,height:24,borderRadius:12,background:agent.enabled?C.navy:'var(--color-border-secondary)',cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                      {toggling===agent.id?
                        <Loader2 size={14} style={{position:'absolute',top:5,left:15,color:'#fff'}}/>:
                        <div style={{position:'absolute',top:3,left:agent.enabled?22:3,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
                      }
                    </div>

                    {/* Run */}
                    <button onClick={()=>runAgent(agent.id)} disabled={running===agent.id}
                      style={{borderRadius:8,border:`0.5px solid ${C.navy}44`,background:'transparent',color:C.navy,padding:'6px 12px',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',gap:5,opacity:running===agent.id?0.5:1}}>
                      {running===agent.id?<Loader2 size={11}/>:<Play size={11}/>}
                      {running===agent.id?'Running…':'Run now'}
                    </button>

                    {/* Expand/collapse */}
                    {output && (
                      <button onClick={()=>setExpanded(e=>e===agent.id?null:agent.id)}
                        style={{borderRadius:8,border:'0.5px solid var(--color-border-secondary)',background:'transparent',color:'var(--color-text-secondary)',padding:'6px 10px',cursor:'pointer',fontSize:12}}>
                        {isExpanded?'▲':'▼'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions list */}
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>
                  {agent.actions.map(a=>(
                    <span key={a} style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:'var(--color-background-secondary)',color:'var(--color-text-tertiary)'}}>
                      {a.replace(/_/g,' ')}
                    </span>
                  ))}
                </div>

                {/* Run output */}
                {isExpanded && output && (
                  <div style={{marginTop:14,padding:'14px',borderRadius:8,background:'var(--color-background-secondary)',border:'0.5px solid var(--color-border-tertiary)'}}>
                    <p style={{fontSize:11,fontWeight:500,color:CAT_COL[agent.category]??C.navy,marginBottom:8}}>
                      AGENT OUTPUT — {new Date(agent.last_run_at??'').toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                    </p>
                    <pre style={{whiteSpace:'pre-wrap',fontSize:12,lineHeight:1.75,fontFamily:'inherit',margin:0,color:'var(--color-text-primary)'}}>{output}</pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
