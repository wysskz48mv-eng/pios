/**
 * /platform/contracts — Contract Register + renewal intelligence
 * PIOS Sprint 36 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { FileText, Plus, Zap, Loader2, AlertTriangle, Trash2, Edit2, Copy, Check } from 'lucide-react'

type Contract = {
  id: string; title: string; contract_type: string; counterparty: string
  status: string; value?: number; currency?: string
  start_date?: string; end_date?: string; auto_renewal?: boolean
  notice_period_days?: number; renewal_date?: string
  key_terms?: string; obligations?: string; domain?: string; notes?: string
  created_at: string
}

const TYPE_COLOR: Record<string, string> = {
  client:      'bg-green-500/10 text-green-400 border-green-500/20',
  supplier:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  employment:  'bg-violet-500/10 text-violet-400 border-violet-500/20',
  nda:         'bg-amber-500/10 text-amber-400 border-amber-500/20',
  licence:     'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  partnership: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  lease:       'bg-orange-500/10 text-orange-400 border-orange-500/20',
  service:     'bg-pink-500/10 text-pink-400 border-pink-500/20',
  other:       'bg-slate-500/10 text-slate-400 border-slate-500/20',
}
const STATUS_COLOR: Record<string, string> = {
  active:     'bg-green-500/10 text-green-400 border-green-500/20',
  draft:      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  expired:    'bg-red-500/10 text-red-400 border-red-500/20',
  terminated: 'bg-red-500/10 text-red-400 border-red-500/20',
  renewed:    'bg-teal-500/10 text-teal-400 border-teal-500/20',
  pending:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

const BLANK = { title:'', contract_type:'client', counterparty:'', status:'active', value:'', currency:'GBP', start_date:'', end_date:'', auto_renewal:false, notice_period_days:'', renewal_date:'', key_terms:'', obligations:'', domain:'business', notes:'' }

export default function ContractsPage() {
  const [contracts, setContracts]   = useState<Contract[]>([])
  const [alerts, setAlerts]         = useState<Contract[]>([])
  const [totalValue, setTotalValue] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [review, setReview]         = useState<string | null>(null)
  const [reviewing, setReviewing]   = useState(false)
  const [copied, setCopied]         = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<Contract | null>(null)
  const [form, setForm]             = useState({ ...BLANK })
  const [saving, setSaving]         = useState(false)
  const [statusFilter, setStatus]   = useState('all')
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [expanded, setExpanded]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/contracts')
      const d = await r.json()
      setContracts(d.contracts ?? [])
      setAlerts(d.renewalAlerts ?? [])
      setTotalValue(d.totalValue ?? 0)
    } catch { /**/ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const payload = editing
        ? { action: 'update', id: editing.id, ...form, value: form.value ? parseFloat(String(form.value)) : null, notice_period_days: form.notice_period_days ? parseInt(String(form.notice_period_days)) : null }
        : { action: 'create', ...form, value: form.value ? parseFloat(String(form.value)) : null, notice_period_days: form.notice_period_days ? parseInt(String(form.notice_period_days)) : null }
      await fetch('/api/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setShowModal(false); setEditing(null); setForm({ ...BLANK }); await load()
    } catch { /**/ }
    setSaving(false)
  }

  async function del(id: string) {
    setDeleting(id)
    await fetch('/api/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) })
    setDeleting(null); await load()
  }

  async function aiReview() {
    setReviewing(true)
    try {
      const r = await fetch('/api/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ai_review' }) })
      const d = await r.json()
      setReview(d.review ?? null)
    } catch { /**/ }
    setReviewing(false)
  }

  const statuses = ['all', 'active', 'draft', 'pending', 'expired', 'terminated']
  const filtered = statusFilter === 'all' ? contracts : contracts.filter(c => c.status === statusFilter)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-xl font-semibold">Contract Register</h1>
            <p className="text-sm text-muted-foreground">Client agreements · supplier contracts · NDAs · licences · renewals</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={aiReview} disabled={reviewing || contracts.length === 0} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/15 disabled:opacity-50">
            {reviewing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            AI Review
          </button>
          <button onClick={() => { setEditing(null); setForm({ ...BLANK }); setShowModal(true) }} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600">
            <Plus className="w-3 h-3" /> Add Contract
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-amber-400" /><span className="text-sm font-semibold text-amber-400">{alerts.length} contract{alerts.length > 1 ? 's' : ''} expiring within 60 days</span></div>
          {alerts.map(a => (
            <div key={a.id} className="text-sm text-amber-300/80 ml-6">· {a.title} ({a.counterparty}) — expires {a.end_date}{a.auto_renewal ? ' [auto-renews]' : ''}</div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Active contracts', value: contracts.filter(c => c.status === 'active').length },
          { label: 'Total value', value: `£${totalValue.toLocaleString()}` },
          { label: 'Expiring soon', value: alerts.length },
          { label: 'Total registered', value: contracts.length },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {statuses.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${statusFilter === s ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {s} {s !== 'all' && <span className="opacity-60">({contracts.filter(c => c.status === s).length})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-3 opacity-20" />
          <p>No contracts registered yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 flex items-start justify-between gap-4 cursor-pointer" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm">{c.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLOR[c.contract_type] ?? ''}`}>{c.contract_type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[c.status] ?? ''}`}>{c.status}</span>
                    {c.auto_renewal && <span className="text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full">auto-renews</span>}
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <span className="text-xs text-muted-foreground">With: {c.counterparty}</span>
                    {c.value ? <span className="text-xs text-muted-foreground">{c.currency ?? 'GBP'} {Number(c.value).toLocaleString()}</span> : null}
                    {c.end_date && <span className={`text-xs ${alerts.some(a => a.id === c.id) ? 'text-amber-400' : 'text-muted-foreground'}`}>Ends: {c.end_date}</span>}
                    {c.notice_period_days ? <span className="text-xs text-muted-foreground">{c.notice_period_days}d notice</span> : null}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); setEditing(c); setForm({ title:c.title, contract_type:c.contract_type, counterparty:c.counterparty, status:c.status, value:String(c.value??''), currency:c.currency??'GBP', start_date:c.start_date??'', end_date:c.end_date??'', auto_renewal:c.auto_renewal??false, notice_period_days:String(c.notice_period_days??''), renewal_date:c.renewal_date??'', key_terms:c.key_terms??'', obligations:c.obligations??'', domain:c.domain??'business', notes:c.notes??'' }); setShowModal(true) }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={e => { e.stopPropagation(); del(c.id) }} disabled={deleting === c.id} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400">{deleting === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                </div>
              </div>
              {expanded === c.id && (c.key_terms || c.obligations || c.notes) && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
                  {c.key_terms && <div><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key terms</span><p className="text-xs mt-1 text-foreground/80">{c.key_terms}</p></div>}
                  {c.obligations && <div><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Obligations</span><p className="text-xs mt-1 text-foreground/80">{c.obligations}</p></div>}
                  {c.notes && <div><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</span><p className="text-xs mt-1 text-foreground/80">{c.notes}</p></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {review && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-blue-400" /><span className="text-sm font-semibold text-blue-400">Contract Portfolio Review — AI Generated</span></div>
            <button onClick={() => { navigator.clipboard.writeText(review); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{review}</pre>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-lg space-y-4 my-4">
            <h3 className="text-base font-semibold">{editing ? 'Edit Contract' : 'Add Contract'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Title *</label><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="pios-input w-full" placeholder="e.g. VeritasEdge SaaS Licence — Qiddiya" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Type</label><select value={form.contract_type} onChange={e => setForm(p => ({ ...p, contract_type: e.target.value }))} className="pios-input w-full">{['client','supplier','employment','nda','licence','partnership','lease','service','other'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Status</label><select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="pios-input w-full">{['active','draft','pending','expired','terminated','renewed'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Counterparty *</label><input value={form.counterparty} onChange={e => setForm(p => ({ ...p, counterparty: e.target.value }))} className="pios-input w-full" placeholder="Company or individual name" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Value</label><input type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} className="pios-input w-full" placeholder="0" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Currency</label><select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="pios-input w-full">{['GBP','USD','EUR','AED','SAR'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Start date</label><input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className="pios-input w-full" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">End date</label><input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className="pios-input w-full" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Notice period (days)</label><input type="number" value={form.notice_period_days} onChange={e => setForm(p => ({ ...p, notice_period_days: e.target.value }))} className="pios-input w-full" placeholder="30" /></div>
              <div className="flex items-center gap-2 pt-4"><input type="checkbox" checked={form.auto_renewal} onChange={e => setForm(p => ({ ...p, auto_renewal: e.target.checked }))} className="rounded" id="auto-renewal" /><label htmlFor="auto-renewal" className="text-sm">Auto-renews</label></div>
              <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Key terms</label><textarea value={form.key_terms} onChange={e => setForm(p => ({ ...p, key_terms: e.target.value }))} rows={2} className="pios-input w-full resize-none" /></div>
              <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Obligations</label><textarea value={form.obligations} onChange={e => setForm(p => ({ ...p, obligations: e.target.value }))} rows={2} className="pios-input w-full resize-none" /></div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => { setShowModal(false); setEditing(null) }} className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
              <button onClick={save} disabled={!form.title.trim() || !form.counterparty.trim() || saving} className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Update' : 'Add Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
