/**
 * /platform/intelligence — FM & Research Intelligence Feed
 * PIOS v2.7 | VeritasIQ Technologies Ltd
 */
"use client"
import Link from 'next/link'
import { useState, useEffect } from "react"
import { Rss, Loader2, ExternalLink, RefreshCw, BookOpen, Globe, TrendingUp, Calendar } from "lucide-react"

type FeedItem = { id: string; title: string; summary: string; source: string; url?: string; category: string; published_at?: string; relevance_score?: number }

const CAT_COLOR: Record<string, string> = {
  fm_industry: "bg-blue-500/10 text-blue-400",
  academic: "bg-violet-500/10 text-violet-400",
  regulatory: "bg-amber-500/10 text-amber-400",
  market: "bg-green-500/10 text-green-400",
  dba: "bg-pink-500/10 text-pink-400",
}

export default function IntelligencePage() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState("all")

  useEffect(() => { load() }, [])

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true)
    try {
      const r = await fetch("/api/feeds?limit=30" + (refresh ? "&refresh=1" : ""))
      const d = await r.json()
      setItems(d.items ?? [])
    } catch { setItems([]) }
    setLoading(false); setRefreshing(false)
  }

  const categories = ["all", ...Array.from(new Set(items.map(i => i.category))).filter(Boolean)]
  const filtered = category === "all" ? items : items.filter(i => i.category === category)

  return (
    <div className="p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Rss className="w-5 h-5 text-violet-500" />
            <h1 className="text-xl font-bold">Intelligence Feed</h1>
          </div>
          <p className="text-sm text-muted-foreground">FM industry, academic, regulatory and market intelligence — curated daily</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-card disabled:opacity-60">
          <RefreshCw className={"w-4 h-4 " + (refreshing ? "animate-spin" : "")} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* SIA™ link — upgrade to Signal Brief */}
      <div className="flex items-center justify-between mb-4 p-4 rounded-xl bg-violet-500/5 border border-violet-500/20">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-2 h-2 rounded-full bg-violet-400" />
            <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">SIA™ Strategic Intelligence Agent</span>
          </div>
          <p className="text-xs text-muted-foreground">Get executive-grade Signal Briefs with SO WHAT analysis across 6 sectors</p>
        </div>
        <Link href="/platform/comms?tab=sia"
          className="flex-shrink-0 text-xs px-4 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg font-medium hover:bg-violet-500/20 transition-colors">
          Open SIA™ →
        </Link>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-5">
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={"px-3 py-1.5 rounded-full text-xs font-medium border transition-colors " +
              (category === cat ? "border-violet-500/60 bg-violet-500/10 text-violet-400" : "border-border text-muted-foreground hover:text-foreground")}>
            {cat === "all" ? "All" : cat.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading intelligence feed…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Rss className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No intelligence items yet. Add feeds in the Command Centre, then refresh.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <div key={item.id} className="p-4 bg-card border border-border rounded-xl hover:border-violet-500/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide " + (CAT_COLOR[item.category] ?? "bg-gray-500/10 text-gray-400")}>
                      {item.category?.replace(/_/g," ")}
                    </span>
                    {item.relevance_score && item.relevance_score > 0.7 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 uppercase">High relevance</span>
                    )}
                    <span className="text-xs text-muted-foreground">{item.source}</span>
                    {item.published_at && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.published_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold mb-1.5">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.summary}</p>
                </div>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 p-2 text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-card transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
