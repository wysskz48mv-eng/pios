/**
 * /platform/learning/journal — AI-assisted reflective learning journal
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
"use client"
import { useState, useEffect } from "react"
import { BookOpen, Plus, Loader2, Save, Brain, Calendar,
         Tag, ChevronLeft, Trash2 } from "lucide-react"
import Link from "next/link"

type Entry = {
  id: string; title: string; content: string; mood?: string
  tags?: string[]; ai_reflection?: string; created_at: string; updated_at: string
}

const MOODS = ["✨ Breakthrough","💡 Insight","🤔 Questioning","😤 Frustrated","🎯 Focused","😌 Satisfied"]

export default function LearningJournalPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"list"|"write">("list")
  const [selected, setSelected] = useState<Entry|null>(null)
  const [form, setForm] = useState({ title:"", content:"", mood:"", tags:"" })
  const [saving, setSaving] = useState(false)
  const [reflecting, setReflecting] = useState(false)
  const [aiReflection, setAiReflection] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/learning-journey?view=journal")
      const d = await r.json()
      setEntries(d.entries ?? [])
    } catch { setEntries([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      const r = await fetch("/api/learning-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "journal_entry",
          title: form.title,
          content: form.content,
          mood: form.mood,
          tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        })
      })
      const d = await r.json()
      if (d.entry) {
        setEntries(prev => [d.entry, ...prev])
        setForm({ title:"", content:"", mood:"", tags:"" })
        setAiReflection("")
        setView("list")
      }
    } catch { /* silent */ }
    setSaving(false)
  }

  const getAiReflection = async () => {
    if (!form.content.trim()) return
    setReflecting(true)
    try {
      const r = await fetch("/api/learning-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ai_reflect", content: form.content })
      })
      const d = await r.json()
      if (d.reflection) setAiReflection(d.reflection)
    } catch { /* silent */ }
    setReflecting(false)
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", {
    day:"2-digit", month:"short", year:"numeric"
  })

  if (view === "write") return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { setView("list"); setAiReflection("") }}
          className="text-[var(--pios-muted)] hover:text-foreground">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">New Journal Entry</h1>
      </div>

      <div className="space-y-4">
        <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))}
          placeholder="What are you reflecting on?"
          className="w-full px-3 py-2.5 text-sm border border-[var(--pios-border)] rounded-lg bg-[var(--pios-surface)] outline-none focus:border-primary/60" />

        <div className="flex gap-2 flex-wrap">
          {MOODS.map(m => (
            <button key={m} onClick={() => setForm(p=>({...p,mood:p.mood===m?"":m}))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                form.mood===m ? "border-primary/60 bg-primary/10 text-primary" : "border-[var(--pios-border)] text-[var(--pios-muted)] hover:text-foreground"
              }`}>{m}</button>
          ))}
        </div>

        <textarea value={form.content} onChange={e => setForm(p=>({...p,content:e.target.value}))}
          placeholder="Write your reflection… What did you learn? What questions do you have? What will you do differently?"
          rows={10}
          className="w-full px-3 py-2.5 text-sm border border-[var(--pios-border)] rounded-lg bg-[var(--pios-surface)] outline-none focus:border-primary/60 resize-none" />

        <input value={form.tags} onChange={e => setForm(p=>({...p,tags:e.target.value}))}
          placeholder="Tags (comma-separated): research methods, statistics, writing…"
          className="w-full px-3 py-2.5 text-sm border border-[var(--pios-border)] rounded-lg bg-[var(--pios-surface)] outline-none focus:border-primary/60" />

        {aiReflection && (
          <div className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-500 uppercase tracking-wider">AI Reflection</span>
            </div>
            <p className="text-sm text-[var(--pios-muted)] leading-relaxed">{aiReflection}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={save} disabled={saving || !form.title || !form.content}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Entry
          </button>
          <button onClick={getAiReflection} disabled={reflecting || !form.content}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--pios-border)] rounded-lg text-sm hover:bg-[var(--pios-surface)] disabled:opacity-50">
            {reflecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            AI Reflect
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/platform/learning" className="text-[var(--pios-muted)] hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <BookOpen className="w-5 h-5 text-violet-500" />
            <h1 className="text-xl font-bold">Learning Journal</h1>
          </div>
          <p className="text-sm text-[var(--pios-muted)] ml-12">{entries.length} entries</p>
        </div>
        <button onClick={() => setView("write")}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--pios-muted)] text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading journal…
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-[var(--pios-muted)]">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No journal entries yet</p>
          <p className="text-xs mt-1">Start reflecting on your learning journey</p>
          <button onClick={() => setView("write")}
            className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm">
            Write First Entry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.id} className="p-4 bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl hover:border-violet-500/30 transition-colors cursor-pointer"
              onClick={() => { setSelected(selected?.id===entry.id ? null : entry) }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {entry.mood && <span className="text-sm">{entry.mood.split(" ")[0]}</span>}
                    <h3 className="text-sm font-semibold truncate">{entry.title}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--pios-muted)]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{fmtDate(entry.created_at)}
                    </span>
                    {entry.tags && entry.tags.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />{entry.tags.slice(0,2).join(", ")}
                      </span>
                    )}
                  </div>
                  {selected?.id === entry.id && (
                    <div className="mt-3 space-y-3">
                      <p className="text-sm text-[var(--pios-muted)] leading-relaxed whitespace-pre-wrap">
                        {entry.content}
                      </p>
                      {entry.ai_reflection && (
                        <div className="p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Brain className="w-3.5 h-3.5 text-violet-500" />
                            <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">AI Reflection</span>
                          </div>
                          <p className="text-xs text-[var(--pios-muted)] leading-relaxed">{entry.ai_reflection}</p>
                        </div>
                      )}
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
