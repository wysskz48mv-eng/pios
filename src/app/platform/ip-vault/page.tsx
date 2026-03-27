/**
 * /platform/ip-vault — IP Vault · IML™ + IP protection hub
 * PIOS Sprint 36 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Shield, Plus, Zap, Loader2, Copy, Check, AlertTriangle, Trash2, Edit2 } from 'lucide-react'

type IPAsset = {
  id: string; name: string; asset_type: string; description?: string
  status: string; jurisdiction?: string[]; filing_date?: string
  registration_no?: string; renewal_date?: string; owner_entity?: string
  notes?: string; tags?: string[]; created_at: string
}

const TYPE_COLOR: Record<string, string> = {
  framework:    'bg-[var(--ai)]/10 text-[var(--ai3)] border-[rgba(99,73,255,0.2)]',
  trademark:    'bg-[var(--academic)]/10 text-[var(--academic)] border-[rgba(79,142,247,0.2)]',
  patent:       'bg-[var(--saas)]/10 text-[var(--saas)] border-[rgba(245,158,11,0.2)]',
  trade_secret: 'bg-red-500/10 text-[var(--dng)] border-[rgba(244,63,94,0.2)]',
  copyright:    'bg-[rgba(16,185,129,0.1)] text-[var(--fm)] border-[rgba(16,185,129,0.2)]',
  methodology:  'bg-[rgba(56,217,245,0.08)] text-[var(--pro)] border-[rgba(56,217,245,0.2)]',
  process:      'bg-pink-500/10 text-pink-400 border-pink-500/20',
  brand:        'bg-[rgba(249,115,22,0.08)] text-[var(--saas)] border-[rgba(249,115,22,0.2)]',
}
const STATUS_COLOR: Record<string, string> = {
  active:     'bg-[rgba(16,185,129,0.1)] text-[var(--fm)] border-[rgba(16,185,129,0.2)]',
  pending:    'bg-[var(--saas)]/10 text-[var(--saas)] border-[rgba(245,158,11,0.2)]',
  filed:      'bg-[var(--academic)]/10 text-[var(--academic)] border-[rgba(79,142,247,0.2)]',
  registered: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  lapsed:     'bg-red-500/10 text-[var(--dng)] border-[rgba(244,63,94,0.2)]',
  archived:   'bg-[var(--pios-surface2)] text-[var(--pios-muted)] border-[var(--pios-border2)]/20',
}

const BLANK = { name:'', asset_type:'framework', description:'', status:'active', jurisdiction:[] as string[], filing_date:'', registration_no:'', renewal_date:'', owner_entity:'VeritasIQ Technologies Ltd', notes:'' }

export default function IPVaultPage() {
  const [assets, setAssets]           = useState<IPAsset[]>([])
  const [alerts, setAlerts]           = useState<IPAsset[]>([])
  const [loading, setLoading]         = useState(true)
  const [brief, setBrief]             = useState<string | null>(null)
  const [briefing, setBriefing]       = useState(false)
  const [copied, setCopied]           = useState(false)
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<IPAsset | null>(null)
  const [form, setForm]               = useState({ ...BLANK })
  const [saving, setSaving]           = useState(false)
  const [activeType, setActiveType]   = useState('all')
  const [deleting, setDeleting]       = useState<string | null>(null)
  const [seeding, setSeeding]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/ip-vault')
      const d = await r.json()
      setAssets(d.assets ?? [])
      setAlerts(d.renewalAlerts ?? [])
    } catch { /**/ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const action = editing ? 'update' : 'create'
      const payload = editing ? { action, id: editing.id, ...form } : { action, ...form }
      await fetch('/api/ip-vault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setShowModal(false); setEditing(null); setForm({ ...BLANK })
      await load()
    } catch { /**/ }
    setSaving(false)
  }

  async function deleteAsset(id: string) {
    setDeleting(id)
    await fetch('/api/ip-vault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) })
    setDeleting(null)
    await load()
  }

  async function generateBrief() {
    setBriefing(true)
    try {
      const r = await fetch('/api/ip-vault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ai_brief' }) })
      const d = await r.json()
      setBrief(d.brief ?? null)
    } catch { /**/ }
    setBriefing(false)
  }

  const types = ['all', ...Array.from(new Set(assets.map(a => a.asset_type)))]
  const filtered = activeType === 'all' ? assets : assets.filter(a => a.asset_type === activeType)
  const byType: Record<string, number> = {}
  assets.forEach(a => { byType[a.asset_type] = (byType[a.asset_type] ?? 0) + 1 })

  async function seedFrameworks() {
    setSeeding(true)
    try {
      const r = await fetch('/api/ip-vault', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_frameworks' }),
      })
      const d = await r.json()
      if (d.seeded > 0) await load()
      alert(`Seeded ${d.seeded} frameworks. ${d.skipped} already existed.`)
    } catch { alert('Seed failed — run M019 migration first.') }
    setSeeding(false)
  }


  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-[var(--ai3)]" />
          <div>
            <h1 className="text-xl font-semibold">IP Vault</h1>
            <p className="text-sm text-[var(--pios-muted)]">Proprietary frameworks · trademarks · trade secrets · methodologies</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={generateBrief} disabled={briefing || assets.length === 0} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--pios-border)] bg-[var(--ai)]/10 text-[var(--ai3)] text-sm font-medium hover:bg-[var(--ai)]/15 disabled:opacity-50">
            {briefing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            IP Brief
          </button>
          <button onClick={seedFrameworks} disabled={seeding} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[rgba(99,73,255,0.3)] text-[var(--ai3)] text-sm hover:bg-[var(--ai)]/10 disabled:opacity-50">
            {seeding ? <Loader2 className="w-3 h-3 animate-spin" /> : '🧬'} Seed NemoClaw™
          </button>
          <button onClick={() => { setEditing(null); setForm({ ...BLANK }); setShowModal(true) }} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--ai)] text-white text-sm font-medium hover:bg-[var(--ai)]">
            <Plus className="w-3 h-3" /> Add Asset
          </button>
        </div>
      </div>

      {/* Renewal alerts */}
      {alerts.length > 0 && (
        <div className="bg-[var(--saas)]/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-[var(--saas)]" /><span className="text-sm font-semibold text-[var(--saas)]">Renewal alerts — {alerts.length} asset{alerts.length > 1 ? 's' : ''} require attention within 90 days</span></div>
          {alerts.map(a => (
            <div key={a.id} className="text-sm text-[rgba(245,158,11,0.8)] ml-6">· {a.name} ({a.asset_type}) — renewal due {a.renewal_date}</div>
          ))}
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total assets', value: assets.length },
          { label: 'Frameworks', value: byType['framework'] ?? 0 },
          { label: 'Trademarks', value: byType['trademark'] ?? 0 },
          { label: 'Active', value: assets.filter(a => a.status === 'active').length },
        ].map(s => (
          <div key={s.label} className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-[var(--pios-muted)] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setActiveType(t)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${activeType === t ? 'bg-[var(--ai)]/15 text-[var(--ai3)] border-[rgba(99,73,255,0.3)]' : 'border-[var(--pios-border)] text-[var(--pios-muted)] hover:text-foreground'}`}>
            {t.replace('_', ' ')} {t !== 'all' && <span className="opacity-60">({byType[t] ?? 0})</span>}
          </button>
        ))}
      </div>

      {/* Asset list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--pios-muted)]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-[var(--pios-muted)]">
          <Shield className="w-8 h-8 mx-auto mb-3 opacity-20" />
          <p>No IP assets registered yet. Use the Seed NemoClaw™ button above to register all 15 proprietary frameworks.</p>
          <p className="mt-1 text-xs">Start by adding your proprietary frameworks, trademarks, and methodologies.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(a => (
            <div key={a.id} className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm">{a.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLOR[a.asset_type] ?? 'bg-[var(--pios-surface2)] text-[var(--pios-muted)] border-[var(--pios-border2)]/20'}`}>{a.asset_type.replace('_', ' ')}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[a.status] ?? ''}`}>{a.status}</span>
                  </div>
                  {a.description && <p className="text-xs text-[var(--pios-muted)] mt-1 line-clamp-2">{a.description}</p>}
                  <div className="flex gap-4 mt-2 flex-wrap">
                    {a.owner_entity && <span className="text-xs text-[var(--pios-muted)]">Owner: {a.owner_entity}</span>}
                    {a.jurisdiction?.length ? <span className="text-xs text-[var(--pios-muted)]">Jurisdictions: {a.jurisdiction.join(', ')}</span> : null}
                    {a.registration_no && <span className="text-xs text-[var(--pios-muted)]">Reg: {a.registration_no}</span>}
                    {a.renewal_date && <span className="text-xs text-[var(--saas)]">Renewal: {a.renewal_date}</span>}
                    {a.filing_date && <span className="text-xs text-[var(--pios-muted)]">Filed: {a.filing_date}</span>}
                  </div>
                  {a.tags?.length ? (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {a.tags.map(t => <span key={t} className="text-xs bg-muted/40 px-2 py-0.5 rounded">{t}</span>)}
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditing(a); setForm({ name:a.name, asset_type:a.asset_type, description:a.description??'', status:a.status, jurisdiction:a.jurisdiction??[], filing_date:a.filing_date??'', registration_no:a.registration_no??'', renewal_date:a.renewal_date??'', owner_entity:a.owner_entity??'VeritasIQ Technologies Ltd', notes:a.notes??'' }); setShowModal(true) }} className="p-1.5 rounded-lg hover:bg-muted text-[var(--pios-muted)] hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteAsset(a.id)} disabled={deleting === a.id} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--pios-muted)] hover:text-[var(--dng)]">{deleting === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Brief output */}
      {brief && (
        <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-[var(--ai3)]" /><span className="text-sm font-semibold text-[var(--ai3)]">IP Strategy Brief — AI Generated</span></div>
            <button onClick={() => { navigator.clipboard.writeText(brief); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="flex items-center gap-1 text-xs text-[var(--pios-muted)] hover:text-foreground">
              {copied ? <Check className="w-3 h-3 text-[var(--fm)]" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{brief}</pre>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-background border border-[var(--pios-border)] rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h3 className="text-base font-semibold">{editing ? 'Edit IP Asset' : 'Register IP Asset'}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-[var(--pios-muted)] mb-1 block">Asset name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Portfolio Opportunity Matrix™" className="pios-input w-full" />
              </div>
              <div>
                <label className="text-xs text-[var(--pios-muted)] mb-1 block">Asset type</label>
                <select value={form.asset_type} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value }))} className="pios-input w-full">
                  {['framework','trademark','patent','trade_secret','copyright','methodology','process','brand'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--pios-muted)] mb-1 block">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="pios-input w-full">
                  {['active','pending','filed','registered','lapsed','archived'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[var(--pios-muted)] mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="pios-input w-full resize-none" placeholder="Brief description of what this IP covers" />
              </div>
              <div>
                <label className="text-xs text-[var(--pios-muted)] mb-1 block">Filing date</label>
                <input type="date" value={form.filing_date} onChange={e => setForm(p => ({ ...p, filing_date: e.target.value }))} className="pios-input w-full" />
              </div>
              <div>
                <label className="text-xs text-[var(--pios-muted)] mb-1 block">Renewal date</label>
                <input type="date" value={form.renewal_date} onChange={e => setForm(p => ({ ...p, renewal_date: e.target.value }))} className="pios-input w-full" />
              </div>
              <div>
                <label className="text-xs text-[var(--pios-muted)] mb-1 block">Registration no.</label>
                <input value={form.registration_no} onChange={e => setForm(p => ({ ...p, registration_no: e.target.value }))} placeholder="UK00123456" className="pios-input w-full" />
              </div>
              <div>
                <label className="text-xs text-[var(--pios-muted)] mb-1 block">Owner entity</label>
                <input value={form.owner_entity} onChange={e => setForm(p => ({ ...p, owner_entity: e.target.value }))} className="pios-input w-full" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[var(--pios-muted)] mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="pios-input w-full resize-none" />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => { setShowModal(false); setEditing(null) }} className="px-4 py-2 rounded-xl border border-[var(--pios-border)] text-sm hover:bg-muted">Cancel</button>
              <button onClick={save} disabled={!form.name.trim() || saving} className="px-4 py-2 rounded-xl bg-[var(--ai)] text-white text-sm font-medium hover:bg-[var(--ai)] disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Update' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
