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
  framework:    'bg-violet-500/10 text-violet-400 border-violet-500/20',
  trademark:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  patent:       'bg-amber-500/10 text-amber-400 border-amber-500/20',
  trade_secret: 'bg-red-500/10 text-red-400 border-red-500/20',
  copyright:    'bg-green-500/10 text-green-400 border-green-500/20',
  methodology:  'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  process:      'bg-pink-500/10 text-pink-400 border-pink-500/20',
  brand:        'bg-orange-500/10 text-orange-400 border-orange-500/20',
}
const STATUS_COLOR: Record<string, string> = {
  active:     'bg-green-500/10 text-green-400 border-green-500/20',
  pending:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  filed:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  registered: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  lapsed:     'bg-red-500/10 text-red-400 border-red-500/20',
  archived:   'bg-slate-500/10 text-slate-400 border-slate-500/20',
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-violet-400" />
          <div>
            <h1 className="text-xl font-semibold">IP Vault</h1>
            <p className="text-sm text-muted-foreground">Proprietary frameworks · trademarks · trade secrets · methodologies</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={generateBrief} disabled={briefing || assets.length === 0} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-violet-500/10 text-violet-400 text-sm font-medium hover:bg-violet-500/15 disabled:opacity-50">
            {briefing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            IP Brief
          </button>
          <button onClick={() => { setEditing(null); setForm({ ...BLANK }); setShowModal(true) }} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600">
            <Plus className="w-3 h-3" /> Add Asset
          </button>
        </div>
      </div>

      {/* Renewal alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-amber-400" /><span className="text-sm font-semibold text-amber-400">Renewal alerts — {alerts.length} asset{alerts.length > 1 ? 's' : ''} require attention within 90 days</span></div>
          {alerts.map(a => (
            <div key={a.id} className="text-sm text-amber-300/80 ml-6">· {a.name} ({a.asset_type}) — renewal due {a.renewal_date}</div>
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
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setActiveType(t)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${activeType === t ? 'bg-violet-500/15 text-violet-400 border-violet-500/30' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {t.replace('_', ' ')} {t !== 'all' && <span className="opacity-60">({byType[t] ?? 0})</span>}
          </button>
        ))}
      </div>

      {/* Asset list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <Shield className="w-8 h-8 mx-auto mb-3 opacity-20" />
          <p>No IP assets registered yet.</p>
          <p className="mt-1 text-xs">Start by adding your proprietary frameworks, trademarks, and methodologies.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(a => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm">{a.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLOR[a.asset_type] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>{a.asset_type.replace('_', ' ')}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[a.status] ?? ''}`}>{a.status}</span>
                  </div>
                  {a.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>}
                  <div className="flex gap-4 mt-2 flex-wrap">
                    {a.owner_entity && <span className="text-xs text-muted-foreground">Owner: {a.owner_entity}</span>}
                    {a.jurisdiction?.length ? <span className="text-xs text-muted-foreground">Jurisdictions: {a.jurisdiction.join(', ')}</span> : null}
                    {a.registration_no && <span className="text-xs text-muted-foreground">Reg: {a.registration_no}</span>}
                    {a.renewal_date && <span className="text-xs text-amber-400">Renewal: {a.renewal_date}</span>}
                    {a.filing_date && <span className="text-xs text-muted-foreground">Filed: {a.filing_date}</span>}
                  </div>
                  {a.tags?.length ? (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {a.tags.map(t => <span key={t} className="text-xs bg-muted/40 px-2 py-0.5 rounded">{t}</span>)}
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditing(a); setForm({ name:a.name, asset_type:a.asset_type, description:a.description??'', status:a.status, jurisdiction:a.jurisdiction??[], filing_date:a.filing_date??'', registration_no:a.registration_no??'', renewal_date:a.renewal_date??'', owner_entity:a.owner_entity??'VeritasIQ Technologies Ltd', notes:a.notes??'' }); setShowModal(true) }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteAsset(a.id)} disabled={deleting === a.id} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400">{deleting === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Brief output */}
      {brief && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-violet-400" /><span className="text-sm font-semibold text-violet-400">IP Strategy Brief — AI Generated</span></div>
            <button onClick={() => { navigator.clipboard.writeText(brief); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{brief}</pre>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h3 className="text-base font-semibold">{editing ? 'Edit IP Asset' : 'Register IP Asset'}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Asset name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Portfolio Opportunity Matrix™" className="pios-input w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Asset type</label>
                <select value={form.asset_type} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value }))} className="pios-input w-full">
                  {['framework','trademark','patent','trade_secret','copyright','methodology','process','brand'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="pios-input w-full">
                  {['active','pending','filed','registered','lapsed','archived'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="pios-input w-full resize-none" placeholder="Brief description of what this IP covers" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Filing date</label>
                <input type="date" value={form.filing_date} onChange={e => setForm(p => ({ ...p, filing_date: e.target.value }))} className="pios-input w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Renewal date</label>
                <input type="date" value={form.renewal_date} onChange={e => setForm(p => ({ ...p, renewal_date: e.target.value }))} className="pios-input w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Registration no.</label>
                <input value={form.registration_no} onChange={e => setForm(p => ({ ...p, registration_no: e.target.value }))} placeholder="UK00123456" className="pios-input w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Owner entity</label>
                <input value={form.owner_entity} onChange={e => setForm(p => ({ ...p, owner_entity: e.target.value }))} className="pios-input w-full" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="pios-input w-full resize-none" />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => { setShowModal(false); setEditing(null) }} className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
              <button onClick={save} disabled={!form.name.trim() || saving} className="px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Update' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
