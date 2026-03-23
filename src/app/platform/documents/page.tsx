/**
 * /platform/documents — Document Intelligence Hub
 * PIOS v2.2 | VeritasIQ Technologies Ltd
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
    } catch { /* silent */ }
    setAnalysing(false)
  }

  const filtered = docs.filter(d =>
    !query || d.name.toLowerCase().includes(query.toLowerCase()) ||
    d.summary?.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="w-5 h-5 text-violet-500" />
            <h1 className="text-xl font-bold">Document Intelligence</h1>
          </div>
          <p className="text-sm text-muted-foreground">AI-powered analysis — summaries, tags, and knowledge extraction</p>
        </div>
        <a href="/platform/files"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:opacity-90">
          <Upload className="w-4 h-4" /> Upload Files
        </a>
      </div>

      <div className="relative mb-5">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search documents…"
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-lg outline-none focus:border-violet-500/60" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* List */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {loading ? "Loading…" : `${filtered.length} documents`}
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No documents. Upload files first.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(doc => (
                <button key={doc.id} onClick={() => setSelected(doc)}
                  className={"w-full text-left p-3 rounded-lg border transition-colors " +
                    (selected?.id === doc.id ? "border-violet-500/60 bg-violet-500/5" : "border-border bg-card hover:border-violet-500/30")}>
                  <div className="flex items-start gap-3">
                    <FileText className={"w-4 h-4 mt-0.5 flex-shrink-0 " + (doc.summary ? "text-violet-500" : "text-muted-foreground")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{doc.file_type?.toUpperCase()} {doc.size_kb ? `· ${doc.size_kb} KB` : ""}</p>
                      {doc.tags && <div className="flex gap-1 flex-wrap mt-1.5">{doc.tags.slice(0,3).map(t=><span key={t} className="text-[10px] px-1.5 py-0.5 bg-violet-500/10 text-violet-400 rounded">{t}</span>)}</div>}
                    </div>
                    {doc.summary && <FileCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="bg-card border border-border rounded-xl p-5 h-fit sticky top-6">
          {!selected ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Select a document to view AI analysis
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-sm mb-1">{selected.name}</h3>
              <p className="text-xs text-muted-foreground mb-4">{selected.file_type?.toUpperCase()} · {selected.size_kb} KB</p>
              {!selected.summary ? (
                <button onClick={() => analyse(selected)} disabled={analysing}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60">
                  {analysing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</> : <><Brain className="w-4 h-4" /> Analyse with AI</>}
                </button>
              ) : (
                <>
                  <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">Summary</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 bg-violet-500/5 p-3 rounded-lg">{selected.summary}</p>
                  {selected.tags && selected.tags.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">Tags</p>
                      <div className="flex gap-1.5 flex-wrap">{selected.tags.map(t=><span key={t} className="text-xs px-2 py-1 bg-violet-500/10 text-violet-400 rounded-md">{t}</span>)}</div>
                    </>
                  )}
                  <button onClick={() => analyse(selected)} disabled={analysing}
                    className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded px-3 py-1.5 hover:text-foreground">
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
