/**
 * /platform/documents — Document Intelligence Hub
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
"use client"
import { useState, useEffect } from "react"
import { FileText, Upload, Search, Loader2, FolderOpen, Brain, FileCheck, Tag } from "lucide-react"

type Doc = { id: string; name: string; file_type: string; size_kb: number; summary?: string; tags?: string[]; created_at: string }

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Doc | null>(null)
  const [analysing, setAnalysing] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/files/list?limit=50")
      const d = await r.json()
      setDocs(d.files ?? [])
    } catch { setDocs([]) }
    setLoading(false)
  }

  const analyse = async (doc: Doc) => {
    setSelected(doc); setAnalysing(true)
    try {
      const r = await fetch("/api/files/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: doc.id }),
      })
      const d = await r.json()
      if (d.summary) {
        const upd = { ...doc, summary: d.summary, tags: d.tags }
        setDocs(prev => prev.map(f => f.id === doc.id ? upd : f))
        setSelected(upd)
      }
    } catch (err) { console.error('[PIOS]', err) }
    setAnalysing(false)
  }

  const filtered = docs.filter(d =>
    !query || d.name.toLowerCase().includes(query.toLowerCase()) ||
    d.summary?.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="w-5 h-5 text-[var(--ai)]" />
            <h1 style={{ fontFamily:"var(--font-display)",fontSize:22,fontWeight:400,letterSpacing:"-0.03em" }}>Document Intelligence</h1>
          </div>
          <p className="text-sm text-[var(--pios-muted)]">AI-powered analysis — summaries, tags, and knowledge extraction</p>
        </div>
        <a href="/platform/files"
          style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 16px",borderRadius:9,background:"var(--ai)",color:"#fff",fontSize:13,fontWeight:500,textDecoration:"none",fontFamily:"var(--font-sans)" }}>
          <Upload className="w-4 h-4" /> Upload Files
        </a>
      </div>

      <div className="relative mb-5">
        <Search className="w-4 h-4 text-[var(--pios-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search documents…"
          className="pios-input" style={{ paddingLeft:36 }} />
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
        {/* List */}
        <div>
          <p style={{ fontFamily:"var(--font-mono)",fontSize:9.5,fontWeight:500,color:"var(--pios-dim)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:12 }}>
            {loading ? "Loading…" : `${filtered.length} documents`}
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-[var(--pios-muted)] text-sm py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-[var(--pios-muted)] text-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No documents. Upload files first.
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {filtered.map(doc => (
                <button key={doc.id} onClick={() => setSelected(doc)}
                  className={"w-full text-left p-3 rounded-lg border transition-colors " +
                    (selected?.id === doc.id ? "border-[var(--ai)] bg-[var(--ai-subtle)]" : "border-[var(--pios-border)] bg-[var(--pios-surface)] hover:border-[rgba(99,73,255,0.3)]")}>
                  <div className="flex items-start gap-3">
                    <FileText className={"w-4 h-4 mt-0.5 flex-shrink-0 " + (doc.summary ? "text-[var(--ai)]" : "text-[var(--pios-muted)]")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-[var(--pios-muted)] mt-0.5">{doc.file_type?.toUpperCase()} {doc.size_kb ? `· ${doc.size_kb} KB` : ""}</p>
                      {doc.tags && <div className="flex gap-1 flex-wrap mt-1.5">{doc.tags.slice(0,3).map(t=><span key={t} className="text-[10px] px-1.5 py-0.5 bg-[var(--ai-subtle)] text-[var(--ai3)] rounded">{t}</span>)}</div>}
                    </div>
                    {doc.summary && <FileCheck className="w-3.5 h-3.5 text-[var(--fm)] flex-shrink-0 mt-0.5" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="pios-card" style={{ position:"sticky",top:24 }}>
          {!selected ? (
            <div className="text-center py-10 text-[var(--pios-muted)] text-sm">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Select a document to view AI analysis
            </div>
          ) : (
            <>
              <h3 style={{ fontSize:13,fontWeight:500,marginBottom:4 }}>{selected.name}</h3>
              <p className="text-xs text-[var(--pios-muted)] mb-4">{selected.file_type?.toUpperCase()} · {selected.size_kb} KB</p>
              {!selected.summary ? (
                <button onClick={() => analyse(selected)} disabled={analysing}
                  style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px",borderRadius:9,background:"var(--ai)",color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",border:"none",fontFamily:"var(--font-sans)" }}>
                  {analysing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</> : <><Brain className="w-4 h-4" /> Analyse with AI</>}
                </button>
              ) : (
                <>
                  <p className="text-xs font-semibold text-[var(--ai3)] uppercase tracking-wider mb-2">Summary</p>
                  <p className="text-sm text-[var(--pios-muted)] leading-relaxed mb-4 bg-[var(--ai-subtle)] p-3 rounded-lg">{selected.summary}</p>
                  {selected.tags && selected.tags.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-[var(--ai3)] uppercase tracking-wider mb-2">Tags</p>
                      <div className="flex gap-1.5 flex-wrap">{selected.tags.map(t=><span key={t} className="text-xs px-2 py-1 bg-[var(--ai-subtle)] text-[var(--ai3)] rounded-md">{t}</span>)}</div>
                    </>
                  )}
                  <button onClick={() => analyse(selected)} disabled={analysing}
                    className="mt-4 flex items-center gap-1.5 text-xs text-[var(--pios-muted)] border border-[var(--pios-border)] rounded px-3 py-1.5 hover:text-[var(--pios-text)]">
                    <Brain className="w-3 h-3" /> Re-analyse
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
