'use client'
// PIOS™ v3.3.0 | Sprint H — Knowledge Graph Visualisation | VeritasIQ Technologies Ltd
import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, RefreshCw, Sparkles, GitBranch, AlertCircle, FileText } from 'lucide-react'

interface Node { id:string; label:string; type:string; colour:string; icon:string; x:number; y:number; category:string }
interface Edge { source:string; target:string; type:string; weight:number }
interface Stats { total_nodes:number; total_edges:number; by_type:Record<string,number>; days_window:number }

const TYPE_COL: Record<string,string> = {
  insight:'#4f8ef7', task:'#22c55e', meeting:'#9c6ef7', literature:'#f59e0b',
  chapter:'#ef4444', concept:'#14b8a6', framework:'#C9A84C',
}
const EDGE_COL: Record<string,string> = {
  action_derived:'#9c6ef7', theoretical_link:'#f59e0b',
  insight_to_task:'#4f8ef7', framework_applied:'#C9A84C', co_occurrence:'#94a3b8',
}

// Demo nodes for empty state
const DEMO_NODES: Node[] = [
  {id:'fw-SDL',label:'SDL Framework',type:'framework',colour:'#C9A84C',icon:'⬡',x:520,y:80,category:'professional'},
  {id:'fw-NemoClaw',label:'NemoClaw™',type:'framework',colour:'#C9A84C',icon:'⬡',x:670,y:140,category:'professional'},
  {id:'ins-1',label:'Qiddiya RFP approach',type:'insight',colour:'#4f8ef7',icon:'💡',x:180,y:120,category:'capture'},
  {id:'ins-2',label:'GCC FM benchmarking gap',type:'insight',colour:'#4f8ef7',icon:'💡',x:120,y:240,category:'capture'},
  {id:'tsk-1',label:'Complete VE Sprint H',type:'task',colour:'#22c55e',icon:'✓',x:440,y:200,category:'execution'},
  {id:'tsk-2',label:'Stripe live keys PIOS',type:'task',colour:'#22c55e',icon:'✓',x:590,y:260,category:'execution'},
  {id:'mtg-1',label:'Supervisor meeting prep',type:'meeting',colour:'#9c6ef7',icon:'🎯',x:370,y:340,category:'collaboration'},
  {id:'ch-1',label:'Ch3: Methodology',type:'chapter',colour:'#ef4444',icon:'📝',x:220,y:400,category:'dba'},
  {id:'ch-2',label:'Ch2: Literature Review',type:'chapter',colour:'#ef4444',icon:'📝',x:100,y:360,category:'dba'},
  {id:'lit-1',label:'Weick Sensemaking 1995',type:'literature',colour:'#f59e0b',icon:'📚',x:200,y:510,category:'research'},
  {id:'lit-2',label:'Klein Data-Frame Model',type:'literature',colour:'#f59e0b',icon:'📚',x:320,y:490,category:'research'},
]
const DEMO_EDGES: Edge[] = [
  {source:'fw-SDL',target:'tsk-1',type:'framework_applied',weight:2},
  {source:'fw-NemoClaw',target:'tsk-2',type:'framework_applied',weight:2},
  {source:'ins-1',target:'tsk-1',type:'insight_to_task',weight:1},
  {source:'ins-2',target:'ch-2',type:'insight_to_task',weight:1},
  {source:'mtg-1',target:'tsk-1',type:'action_derived',weight:2},
  {source:'ch-2',target:'lit-1',type:'theoretical_link',weight:1},
  {source:'ch-2',target:'lit-2',type:'theoretical_link',weight:1},
  {source:'ch-1',target:'ch-2',type:'co_occurrence',weight:1},
  {source:'ins-2',target:'lit-1',type:'insight_to_task',weight:1},
]
const DEMO_STATS: Stats = {total_nodes:11,total_edges:9,by_type:{insight:2,task:2,meeting:1,literature:2,chapter:2,framework:2},days_window:30}

export default function KnowledgeGraphPage() {
  const [nodes,       setNodes]      = useState<Node[]>(DEMO_NODES)
  const [edges,       setEdges]      = useState<Edge[]>(DEMO_EDGES)
  const [stats,       setStats]      = useState<Stats|null>(DEMO_STATS)
  const [loading,     setLoading]    = useState(false)
  const [demoMode,    setDemoMode]   = useState(true)
  const [days,        setDays]       = useState(30)
  const [domain,      setDomain]     = useState<'all'|'professional'|'academic'>('all')
  const [selected,    setSelected]   = useState<Node|null>(null)
  const [synthesis,   setSynthesis]  = useState<string|null>(null)
  const [gaps,        setGaps]       = useState<string|null>(null)
  const [brief,       setBrief]      = useState<string|null>(null)
  const [aiLoading,   setAiLoading]  = useState<string|null>(null)
  const [dragging,    setDragging]   = useState<string|null>(null)
  const [dragOffset,  setDragOffset] = useState({x:0,y:0})
  const [typeFilter,  setTypeFilter] = useState<string>('all')
  const svgRef = useRef<SVGSVGElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({days:String(days),domain})
      const r = await fetch(`/api/knowledge-graph?${p}`)
      const d = await r.json()
      if (r.ok && (d.nodes?.length ?? 0) > 0) {
        setNodes(d.nodes); setEdges(d.edges ?? []); setStats(d.stats); setDemoMode(false)
      } else { setNodes(DEMO_NODES); setEdges(DEMO_EDGES); setStats(DEMO_STATS); setDemoMode(true) }
    } catch { setNodes(DEMO_NODES); setEdges(DEMO_EDGES); setStats(DEMO_STATS); setDemoMode(true) }
    setLoading(false)
  }, [days, domain])
  useEffect(() => { load() }, [load])

  async function runAI(action: string) {
    setAiLoading(action)
    try {
      const r = await fetch('/api/knowledge-graph', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action, nodes, stats }),
      })
      const d = await r.json()
      if (action==='synthesise') setSynthesis(d.synthesis)
      else if (action==='gap-analysis') setGaps(d.gaps)
      else if (action==='weekly-brief') setBrief(d.brief)
    } catch {}
    setAiLoading(null)
  }

  function onMouseDown(e: React.MouseEvent, nodeId: string) {
    e.preventDefault()
    const node = nodes.find(n=>n.id===nodeId)!
    const rect = svgRef.current!.getBoundingClientRect()
    setDragging(nodeId)
    setDragOffset({x:e.clientX-rect.left-node.x, y:e.clientY-rect.top-node.y})
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return
    const rect = svgRef.current!.getBoundingClientRect()
    setNodes(prev => prev.map(n => n.id===dragging ? {...n, x:e.clientX-rect.left-dragOffset.x, y:e.clientY-rect.top-dragOffset.y} : n))
  }

  const visNodes = typeFilter==='all' ? nodes : nodes.filter(n=>n.type===typeFilter)
  const visIds   = new Set(visNodes.map(n=>n.id))
  const visEdges = edges.filter(e=>visIds.has(e.source)&&visIds.has(e.target))

  const C = {navy:'#0D2B52',teal:'#0A7A7A',gold:'#C9A84C'}
  const card = {background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:12,padding:'14px 16px',marginBottom:10} as const

  return (
    <div style={{fontFamily:'var(--font-sans,system-ui)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:16}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:500,color:'var(--color-text-primary)',margin:0,display:'flex',alignItems:'center',gap:8}}>
            <GitBranch size={18} color={C.navy}/> Knowledge Graph
            {demoMode && <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'#fef2f2',color:'#b91c1c',fontWeight:500}}>DEMO</span>}
          </h1>
          <p style={{fontSize:12,color:'var(--color-text-tertiary)',marginTop:4}}>
            Unified view of insights · tasks · meetings · literature · DBA chapters
          </p>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <select value={days} onChange={e=>{setDays(Number(e.target.value))}}
            style={{fontSize:12,padding:'6px 10px',borderRadius:8,border:'0.5px solid var(--color-border-secondary)',background:'var(--color-background-secondary)',color:'var(--color-text-primary)'}}>
            {[7,14,30,60,90].map(d=><option key={d} value={d}>{d}d</option>)}
          </select>
          <select value={domain} onChange={e=>setDomain(e.target.value as any)}
            style={{fontSize:12,padding:'6px 10px',borderRadius:8,border:'0.5px solid var(--color-border-secondary)',background:'var(--color-background-secondary)',color:'var(--color-text-primary)'}}>
            <option value="all">All domains</option>
            <option value="professional">Professional</option>
            <option value="academic">Academic</option>
          </select>
          <button onClick={load} disabled={loading} style={{borderRadius:8,border:'0.5px solid var(--color-border-secondary)',background:'transparent',color:'var(--color-text-secondary)',padding:'7px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:12}}>
            <RefreshCw size={11}/> Refresh
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
          {[
            {l:'Nodes',v:stats.total_nodes},{l:'Edges',v:stats.total_edges},
            ...Object.entries(stats.by_type).filter(([,v])=>v>0).map(([k,v])=>({l:k,v}))
          ].map(s=>(
            <div key={s.l} style={{padding:'5px 12px',borderRadius:8,background:'var(--color-background-secondary)',fontSize:12}}>
              <span style={{color:'var(--color-text-tertiary)'}}>{s.l}: </span>
              <span style={{fontWeight:500,color:TYPE_COL[s.l]??'var(--color-text-primary)'}}>{s.v}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI buttons */}
      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        {[
          {action:'synthesise',   label:'Synthesise',    icon:<Sparkles size={11}/>},
          {action:'gap-analysis', label:'Gap analysis',  icon:<AlertCircle size={11}/>},
          {action:'weekly-brief', label:'Weekly brief',  icon:<FileText size={11}/>},
        ].map(({action,label,icon})=>(
          <button key={action} onClick={()=>runAI(action)} disabled={aiLoading===action}
            style={{borderRadius:8,border:'none',background:C.navy,color:'#fff',padding:'7px 14px',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',gap:6,opacity:aiLoading===action?0.6:1}}>
            {aiLoading===action?<Loader2 size={11}/>:icon} {aiLoading===action?'Running…':label}
          </button>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:4,flexWrap:'wrap'}}>
          {['all',...Object.keys(TYPE_COL)].map(t=>(
            <button key={t} onClick={()=>setTypeFilter(t)}
              style={{fontSize:11,padding:'4px 10px',borderRadius:20,border:'none',cursor:'pointer',
                background:typeFilter===t?(TYPE_COL[t]??C.navy):('var(--color-background-secondary)'),
                color:typeFilter===t?'#fff':'var(--color-text-secondary)',
                fontWeight:typeFilter===t?500:400}}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* AI output panels */}
      {synthesis && (
        <div style={{...card,borderLeft:`3px solid ${C.navy}`,background:'var(--color-background-secondary)',marginBottom:14}}>
          <p style={{fontSize:11,fontWeight:500,color:C.navy,marginBottom:8,display:'flex',alignItems:'center',gap:6}}><Sparkles size={11}/> SYNTHESIS</p>
          <pre style={{whiteSpace:'pre-wrap',fontSize:13,lineHeight:1.75,fontFamily:'inherit',margin:0,color:'var(--color-text-primary)'}}>{synthesis}</pre>
        </div>
      )}
      {gaps && (
        <div style={{...card,borderLeft:'3px solid #ef4444',background:'#ef444408',marginBottom:14}}>
          <p style={{fontSize:11,fontWeight:500,color:'#ef4444',marginBottom:8,display:'flex',alignItems:'center',gap:6}}><AlertCircle size={11}/> GAP ANALYSIS</p>
          <pre style={{whiteSpace:'pre-wrap',fontSize:13,lineHeight:1.75,fontFamily:'inherit',margin:0,color:'var(--color-text-primary)'}}>{gaps}</pre>
        </div>
      )}
      {brief && (
        <div style={{...card,borderLeft:`3px solid ${C.gold}`,background:`${C.gold}08`,marginBottom:14}}>
          <p style={{fontSize:11,fontWeight:500,color:C.gold,marginBottom:8,display:'flex',alignItems:'center',gap:6}}><FileText size={11}/> WEEKLY BRIEF</p>
          <pre style={{whiteSpace:'pre-wrap',fontSize:13,lineHeight:1.75,fontFamily:'inherit',margin:0,color:'var(--color-text-primary)'}}>{brief}</pre>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:selected?'1fr 280px':'1fr',gap:14,alignItems:'start'}}>
        {/* Graph */}
        <div style={{...card,padding:0,overflow:'hidden'}}>
          {/* Legend */}
          <div style={{padding:'10px 14px',borderBottom:'0.5px solid var(--color-border-tertiary)',display:'flex',gap:12,flexWrap:'wrap'}}>
            {Object.entries(TYPE_COL).map(([t,c])=>(
              <span key={t} style={{fontSize:10,display:'flex',alignItems:'center',gap:4}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:c,display:'inline-block'}}/>
                <span style={{color:'var(--color-text-secondary)'}}>{t}</span>
              </span>
            ))}
          </div>
          <svg ref={svgRef} width="100%" viewBox="0 0 780 580" style={{cursor:dragging?'grabbing':'default'}}
            onMouseMove={onMouseMove} onMouseUp={()=>setDragging(null)} onMouseLeave={()=>setDragging(null)}>
            {/* Edges */}
            {visEdges.map((e,i) => {
              const src = visNodes.find(n=>n.id===e.source)
              const tgt = visNodes.find(n=>n.id===e.target)
              if (!src||!tgt) return null
              return (
                <line key={i} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke={EDGE_COL[e.type]??'#94a3b8'} strokeWidth={Math.min(3,e.weight*1.5)}
                  strokeOpacity={0.45} strokeDasharray={e.type==='theoretical_link'?'5 3':undefined}/>
              )
            })}
            {/* Nodes */}
            {visNodes.map(n => (
              <g key={n.id} style={{cursor:'grab'}}
                onMouseDown={ev=>onMouseDown(ev,n.id)}
                onClick={()=>!dragging&&setSelected(selected?.id===n.id?null:n)}>
                <circle cx={n.x} cy={n.y} r={selected?.id===n.id?16:12}
                  fill={n.colour} fillOpacity={selected?.id===n.id?1:0.8}
                  stroke={selected?.id===n.id?'#fff':n.colour} strokeWidth={selected?.id===n.id?2.5:1}/>
                <text x={n.x} y={n.y+20} textAnchor="middle" fontSize={10}
                  fill="var(--color-text-secondary)" style={{pointerEvents:'none'}}>
                  {n.label.length>18?n.label.slice(0,16)+'…':n.label}
                </text>
              </g>
            ))}
          </svg>
          <p style={{fontSize:10,color:'var(--color-text-tertiary)',textAlign:'center',padding:'6px',borderTop:'0.5px solid var(--color-border-tertiary)'}}>
            Click node to inspect · Drag to reposition
          </p>
        </div>

        {/* Node detail */}
        {selected && (
          <div style={{position:'sticky',top:16}}>
            <div style={{...card,borderLeft:`3px solid ${selected.colour}`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                <div>
                  <p style={{fontSize:20,marginBottom:4}}>{selected.icon}</p>
                  <p style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)',marginBottom:2}}>{selected.label}</p>
                  <p style={{fontSize:11,color:'var(--color-text-tertiary)'}}>{selected.type} · {selected.category}</p>
                </div>
                <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--color-text-tertiary)',fontSize:16}}>✕</button>
              </div>
              <div style={{marginTop:10}}>
                <p style={{fontSize:11,color:'var(--color-text-tertiary)',marginBottom:6}}>Connections</p>
                {edges.filter(e=>e.source===selected.id||e.target===selected.id).map((e,i) => {
                  const otherId = e.source===selected.id?e.target:e.source
                  const other   = nodes.find(n=>n.id===otherId)
                  return other ? (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',borderBottom:'0.5px solid var(--color-border-tertiary)',fontSize:12}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:other.colour,flexShrink:0,display:'inline-block'}}/>
                      <span style={{color:'var(--color-text-secondary)',flex:1}}>{other.label}</span>
                      <span style={{fontSize:10,color:EDGE_COL[e.type]??'#999'}}>{e.type.replace(/_/g,' ')}</span>
                    </div>
                  ) : null
                })}
                {edges.filter(e=>e.source===selected.id||e.target===selected.id).length===0 && (
                  <p style={{fontSize:12,color:'var(--color-text-tertiary)'}}>No connections detected</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
