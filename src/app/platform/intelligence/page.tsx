/**
 * /platform/intelligence — Strategic Intelligence Hub
 * AI-powered domain briefings: FM, Academic, SaaS, Regulatory, GCC Market
 * PIOS v3.0 | Sprint 75 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Rss, Loader2, ExternalLink, RefreshCw, Globe, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import Link from 'next/link'

type BriefingItem = {
  headline: string
  summary: string
  source: string
  source_url?: string
  published_relative?: string
  category_tag?: string
  relevance?: number
  so_what?: string
}

type DomainBriefing = {
  domain: string
  label: string
  icon: string
  color: string
  borderColor: string
  items: BriefingItem[]
  ai_synthesis?: string
  generated_at?: string
  loading: boolean
  error?: string
  expanded: boolean
}

type FeedItem = {
  id: string; title: string; summary: string; source: string
  url?: string; category: string; published_at?: string; relevance_score?: number
}

const DOMAINS: Omit<DomainBriefing, 'items'|'ai_synthesis'|'generated_at'|'loading'|'error'|'expanded'>[] = [
  { domain: 'fm_industry',  label: 'FM & Real Estate',    icon: '🏗',  color: 'text-teal-400',    borderColor: 'border-teal-500/20'    },
  { domain: 'academic',     label: 'Academic & DBA',       icon: '📚',  color: 'text-violet-400',  borderColor: 'border-violet-500/20'  },
  { domain: 'saas',         label: 'SaaS & PropTech',      icon: '⚡',  color: 'text-blue-400',    borderColor: 'border-blue-500/20'    },
  { domain: 'regulatory',   label: 'Regulatory & Legal',   icon: '⚖',  color: 'text-amber-400',   borderColor: 'border-amber-500/20'   },
  { domain: 'gcc_market',   label: 'GCC Market',           icon: '🌍',  color: 'text-emerald-400', borderColor: 'border-emerald-500/20' },
]

export default function IntelligencePage() {
  const [briefings, setBriefings] = useState<DomainBriefing[]>(
    DOMAINS.map(d => ({ ...d, items: [], loading: false, expanded: true }))
  )
  const [feedItems, setFeedItems]         = useState<FeedItem[]>([])
  const [feedLoading, setFeedLoading]     = useState(true)
  const [activeTab, setActiveTab]         = useState<'briefings'|'feed'>('briefings')
  const [feedCategory, setFeedCategory]   = useState('all')
  const [globalLoading, setGlobalLoading] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<string|null>(null)

  const loadFeed = useCallback(async (refresh = false) => {
    setFeedLoading(true)
    try {
      const r = await fetch('/api/feeds?limit=40' + (refresh ? '&refresh=1' : ''))
      const d = await r.json()
      setFeedItems(d.items ?? [])
    } catch { setFeedItems([]) }
    setFeedLoading(false)
  }, [])

  const loadBriefing = useCallback(async (domain: string) => {
    setBriefings(prev => prev.map(b => b.domain === domain ? { ...b, loading: true, error: undefined } : b))
    try {
      const r = await fetch('/api/intelligence/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Failed')
      setBriefings(prev => prev.map(b =>
        b.domain === domain
          ? { ...b, loading: false, items: d.items ?? [], ai_synthesis: d.synthesis, generated_at: d.generated_at }
          : b
      ))
    } catch (e: unknown) {
      setBriefings(prev => prev.map(b =>
        b.domain === domain ? { ...b, loading: false, error: (e as Error).message } : b
      ))
    }
  }, [])

  const loadAllBriefings = useCallback(async () => {
    setGlobalLoading(true)
    await Promise.allSettled(DOMAINS.map(d => loadBriefing(d.domain)))
    setLastRefreshed(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    setGlobalLoading(false)
  }, [loadBriefing])

  useEffect(() => {
    loadFeed()
    loadAllBriefings()
  }, [loadFeed, loadAllBriefings])

  const toggleExpand = (domain: string) =>
    setBriefings(prev => prev.map(b => b.domain === domain ? { ...b, expanded: !b.expanded } : b))

  const feedCategories = ['all', ...Array.from(new Set(feedItems.map(i => i.category))).filter(Boolean)]
  const filteredFeed   = feedCategory === 'all' ? feedItems : feedItems.filter(i => i.category === feedCategory)

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold tracking-tight">Intelligence Hub</h1>
          </div>
          <p className="text-sm text-[var(--pios-muted)]">
            AI-curated domain briefings across FM, academic, SaaS, regulatory and GCC markets
            {lastRefreshed && <span className="ml-2 text-xs text-slate-500">· Refreshed {lastRefreshed}</span>}
          </p>
        </div>
        <button
          onClick={() => { loadAllBriefings(); if (activeTab === 'feed') loadFeed(true) }}
          disabled={globalLoading}
          className="flex items-center gap-2 px-4 py-2 border border-[var(--pios-border)] rounded-lg text-sm hover:bg-[var(--pios-surface)] disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={'w-4 h-4 ' + (globalLoading ? 'animate-spin' : '')} />
          {globalLoading ? 'Refreshing…' : 'Refresh All'}
        </button>
      </div>

      {/* SIA Banner */}
      <div className="flex items-center justify-between mb-5 p-4 rounded-xl bg-violet-500/5 border border-violet-500/20">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">SIA™ Strategic Intelligence Agent</span>
          </div>
          <p className="text-xs text-[var(--pios-muted)]">Executive-grade Signal Briefs with SO WHAT analysis across 6 sectors</p>
        </div>
        <Link href="/platform/comms?tab=sia"
          className="flex-shrink-0 text-xs px-4 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg font-medium hover:bg-violet-500/20 transition-colors">
          Open SIA™ →
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-1 w-fit">
        {(['briefings', 'feed'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
              (activeTab === tab ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' : 'text-[var(--pios-muted)] hover:text-[var(--pios-text)]')}>
            {tab === 'briefings' ? '⚡ AI Briefings' : '📡 My Feed'}
          </button>
        ))}
      </div>

      {/* AI Briefings */}
      {activeTab === 'briefings' && (
        <div className="space-y-4">
          {briefings.map(b => (
            <div key={b.domain} className={'bg-[var(--pios-surface)] border rounded-xl overflow-hidden ' + b.borderColor}>

              {/* Domain header */}
              <button onClick={() => toggleExpand(b.domain)}
                className="w-full flex items-center justify-between p-4 hover:bg-[var(--pios-surface)] transition-colors text-left">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{b.icon}</span>
                  <div>
                    <div className={'text-sm font-semibold ' + b.color}>{b.label}</div>
                    {b.generated_at && !b.loading && (
                      <div className="text-xs text-slate-500 mt-0.5">{b.items.length} items · {b.generated_at}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {b.loading && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
                  {!b.loading && (
                    <button onClick={e => { e.stopPropagation(); loadBriefing(b.domain) }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--pios-text)] hover:bg-[var(--pios-surface2)] transition-colors" title="Refresh">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {b.expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </button>

              {b.expanded && (
                <div className="px-4 pb-4 border-t border-[var(--pios-border)]">

                  {/* Skeleton */}
                  {b.loading && (
                    <div className="space-y-3 pt-4">
                      {[1,2,3].map(i => (
                        <div key={i} className="animate-pulse">
                          <div className="h-3 bg-[var(--pios-surface2)] rounded w-3/4 mb-2" />
                          <div className="h-2.5 bg-[var(--pios-surface2)] rounded w-full mb-1" />
                          <div className="h-2.5 bg-[var(--pios-surface2)] rounded w-5/6" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error */}
                  {!b.loading && b.error && (
                    <div className="pt-4 text-xs text-red-400 flex items-center gap-2">
                      <span>⚠</span> {b.error}
                      <button onClick={() => loadBriefing(b.domain)} className="underline hover:no-underline ml-1">Retry</button>
                    </div>
                  )}

                  {/* NemoClaw synthesis */}
                  {!b.loading && b.ai_synthesis && (
                    <div className="mt-4 mb-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">NemoClaw Synthesis</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{b.ai_synthesis}</p>
                    </div>
                  )}

                  {/* Items */}
                  {!b.loading && !b.error && b.items.length > 0 && (
                    <div className="space-y-0 mt-1">
                      {b.items.map((item, idx) => (
                        <div key={idx} className={'py-3.5 ' + (idx < b.items.length - 1 ? 'border-b border-[var(--pios-border)]' : '')}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                {item.category_tag && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--pios-surface2)] text-slate-400 uppercase tracking-wide">
                                    {item.category_tag}
                                  </span>
                                )}
                                {item.relevance && item.relevance >= 4 && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 uppercase">
                                    High relevance
                                  </span>
                                )}
                                <span className="text-xs text-slate-500">{item.source}</span>
                                {item.published_relative && (
                                  <span className="text-xs text-slate-600 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />{item.published_relative}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-sm font-semibold leading-snug mb-1.5">{item.headline}</h3>
                              <p className="text-xs text-[var(--pios-muted)] leading-relaxed">{item.summary}</p>
                              {item.so_what && (
                                <div className="mt-2 flex gap-1.5">
                                  <span className="text-[10px] font-bold text-amber-400 flex-shrink-0 mt-0.5">SO WHAT →</span>
                                  <p className="text-xs text-amber-200/70 leading-relaxed">{item.so_what}</p>
                                </div>
                              )}
                            </div>
                            {item.source_url && (
                              <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                                className="flex-shrink-0 p-2 text-slate-500 hover:text-[var(--pios-text)] border border-[var(--pios-border)] rounded-lg hover:bg-[var(--pios-surface)] transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty state */}
                  {!b.loading && !b.error && b.items.length === 0 && (
                    <div className="pt-4 text-center py-6">
                      <Rss className="w-6 h-6 mx-auto mb-2 opacity-20" />
                      <p className="text-sm text-[var(--pios-muted)]">No briefing generated yet.</p>
                      <button onClick={() => loadBriefing(b.domain)}
                        className="mt-2 text-xs text-violet-400 hover:underline">
                        Generate now →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* My Feed tab */}
      {activeTab === 'feed' && (
        <div>
          <div className="flex gap-2 flex-wrap mb-5">
            {feedCategories.map(cat => (
              <button key={cat} onClick={() => setFeedCategory(cat)}
                className={'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ' +
                  (feedCategory === cat ? 'border-violet-500/60 bg-violet-500/10 text-violet-400' : 'border-[var(--pios-border)] text-[var(--pios-muted)] hover:text-[var(--pios-text)]')}>
                {cat === 'all' ? 'All' : cat.replace(/_/g, ' ')}
              </button>
            ))}
            <button onClick={() => loadFeed(true)} disabled={feedLoading}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-[var(--pios-border)] rounded-full text-xs text-[var(--pios-muted)] hover:text-[var(--pios-text)] disabled:opacity-50">
              <RefreshCw className={'w-3 h-3 ' + (feedLoading ? 'animate-spin' : '')} />
              Refresh
            </button>
          </div>

          {feedLoading ? (
            <div className="flex items-center gap-2 text-[var(--pios-muted)] text-sm py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading feed…
            </div>
          ) : filteredFeed.length === 0 ? (
            <div className="text-center py-12 text-[var(--pios-muted)] text-sm">
              <Rss className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="mb-1">No feed items yet.</p>
              <p className="text-xs">Configure topics in the Command Centre, then refresh.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFeed.map(item => (
                <div key={item.id} className="p-4 bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl hover:border-violet-500/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--pios-surface2)] text-slate-400 uppercase tracking-wide">
                          {item.category?.replace(/_/g, ' ')}
                        </span>
                        {item.relevance_score && item.relevance_score > 0.7 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 uppercase">High relevance</span>
                        )}
                        <span className="text-xs text-[var(--pios-muted)]">{item.source}</span>
                        {item.published_at && (
                          <span className="text-xs text-[var(--pios-muted)] flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(item.published_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold mb-1.5">{item.title}</h3>
                      <p className="text-xs text-[var(--pios-muted)] leading-relaxed">{item.summary}</p>
                    </div>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 p-2 text-[var(--pios-muted)] hover:text-[var(--pios-text)] border border-[var(--pios-border)] rounded-lg hover:bg-[var(--pios-surface)] transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
