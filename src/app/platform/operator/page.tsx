/**
 * /platform/operator — White-label Operator Configuration
 * Branding, feature flags, custom domain, persona defaults
 * PIOS Sprint 42 | VeritasIQ Technologies Ltd
 */
'use client'
import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import { Settings, Palette, Globe, Zap, Loader2, Check, Save, Eye, EyeOff, Shield } from 'lucide-react'

type OperatorConfig = {
  id?: string
  operator_name: string
  slug: string
  logo_url?: string
  primary_colour: string
  accent_colour: string
  support_email: string
  custom_domain?: string
  features_enabled: string[]
  features_disabled: string[]
  default_persona: string
  active: boolean
}

const ALL_FEATURES = [
  { key: 'daily_brief',    label: 'Daily AI Brief',         group: 'core' },
  { key: 'payroll',        label: 'Payroll Engine',          group: 'core' },
  { key: 'consulting',     label: 'Consulting Frameworks',   group: 'core' },
  { key: 'executive_os',   label: 'Executive OS',            group: 'core' },
  { key: 'ip_vault',       label: 'IP Vault',                group: 'ceo' },
  { key: 'contracts',      label: 'Contract Register',       group: 'ceo' },
  { key: 'financials',     label: 'Group P&L',               group: 'ceo' },
  { key: 'knowledge',      label: 'SE-MIL Knowledge',        group: 'ceo' },
  { key: 'academic',       label: 'Academic Hub',            group: 'academic' },
  { key: 'research',       label: 'Research Hub',            group: 'academic' },
  { key: 'cpd',            label: 'CPD Tracker',             group: 'academic' },
  { key: 'email_triage',   label: 'Email AI Triage',         group: 'comms' },
  { key: 'meetings',       label: 'Meeting Intelligence',    group: 'comms' },
  { key: 'comms_hub',      label: 'Comms Hub (BICA™)',       group: 'comms' },
  { key: 'intelligence',   label: 'Live Intelligence Feeds', group: 'data' },
  { key: 'command',        label: 'Command Centre',          group: 'data' },
  { key: 'time_sovereignty',label:'Time Sovereignty (TSA™)', group: 'data' },
]

const PERSONAS = ['founder', 'consultant', 'executive', 'doctoral', 'masters', 'cpd_professional']

const BLANK: OperatorConfig = {
  operator_name: '', slug: '', logo_url: '',
  primary_colour: '#7c3aed', accent_colour: '#0d9488',
  support_email: '', custom_domain: '',
  features_enabled: ALL_FEATURES.map(f => f.key),
  features_disabled: [],
  default_persona: 'founder', active: true,
}

export default function OperatorPage() {
  const [config, setConfig]     = useState<OperatorConfig | null>(null)
  const [form, setForm]         = useState<OperatorConfig>({ ...BLANK })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [preview, setPreview]   = useState(false)
  const [isAdmin, setIsAdmin]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/operator')
      const d = await r.json()
      if (d.operator) {
        setConfig(d.operator)
        setForm({ ...BLANK, ...d.operator })
      }
      setIsAdmin(d.is_super_admin ?? false)
    } catch (err) { console.error('[PIOS]', err) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    try {
      const r = await fetch('/api/operator', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (d.operator) { setConfig(d.operator); setForm({ ...BLANK, ...d.operator }) }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) { console.error('[PIOS]', err) }
    setSaving(false)
  }

  function toggleFeature(key: string) {
    setForm(p => {
      const enabled  = p.features_enabled.includes(key)
      return {
        ...p,
        features_enabled:  enabled ? p.features_enabled.filter(f => f !== key) : [...p.features_enabled, key],
        features_disabled: enabled ? [...p.features_disabled, key] : p.features_disabled.filter(f => f !== key),
      }
    })
  }

  const groupedFeatures = ALL_FEATURES.reduce((acc, f) => {
    if (!acc[f.group]) acc[f.group] = []
    acc[f.group].push(f)
    return acc
  }, {} as Record<string, typeof ALL_FEATURES>)

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--pios-muted)]" />
    </div>
  )

  if (!isAdmin && config === null) return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-8 text-center">
        <Shield className="w-10 h-10 mx-auto mb-4 text-[var(--pios-muted)] opacity-40" />
        <h2 className="text-lg font-semibold mb-2">Operator Configuration</h2>
        <p className="text-sm text-[var(--pios-muted)]">This instance is running on default VeritasIQ branding. Contact your administrator to configure white-label settings.</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-[var(--ai3)]" />
          <div>
            <h1 className="text-xl font-semibold">Operator Configuration</h1>
            <p className="text-sm text-[var(--pios-muted)]">White-label branding, feature flags, custom domain</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPreview(!preview)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--pios-border)] text-sm text-[var(--pios-muted)] hover:text-foreground">
            {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {preview ? 'Edit' : 'Preview'}
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--ai)] text-white text-sm font-medium hover:bg-[var(--ai)] disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5 text-[var(--fm)]" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Config'}
          </button>
        </div>
      </div>

      {/* Preview strip */}
      {preview && (
        <div className="rounded-xl border border-[var(--pios-border)] overflow-hidden">
          <div className="p-4 flex items-center gap-3" style={{ background: form.primary_colour + '15', borderBottom: `1px solid ${form.primary_colour}30` }}>
            {form.logo_url && <Image src={form.logo_url} alt="logo" width={80} height={32} className="h-8 w-auto rounded" unoptimized />}
            <div>
              <div className="font-bold text-base" style={{ color: form.primary_colour }}>{form.operator_name || 'Your Platform Name'}</div>
              {form.custom_domain && <div className="text-xs text-[var(--pios-muted)]">{form.custom_domain}</div>}
            </div>
            <div className="ml-auto flex gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: form.accent_colour + '20', color: form.accent_colour }}>
                {form.default_persona}
              </span>
            </div>
          </div>
          <div className="p-3 flex gap-2 flex-wrap text-xs text-[var(--pios-muted)]">
            {form.features_enabled.slice(0, 8).map(f => (
              <span key={f} className="bg-muted/40 px-2 py-0.5 rounded">{f.replace(/_/g,' ')}</span>
            ))}
            {form.features_enabled.length > 8 && <span>+{form.features_enabled.length - 8} more</span>}
          </div>
        </div>
      )}

      {/* Branding */}
      <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4 text-[var(--ai3)]" />
          <span className="text-sm font-semibold">Branding</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[var(--pios-muted)] mb-1 block">Operator / product name</label>
            <input value={form.operator_name} onChange={e => setForm(p => ({ ...p, operator_name: e.target.value }))}
              placeholder="e.g. AcmeCo Workspace" className="pios-input w-full" />
          </div>
          <div>
            <label className="text-xs text-[var(--pios-muted)] mb-1 block">Slug (URL-safe identifier)</label>
            <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'') }))}
              placeholder="e.g. acmeco" className="pios-input w-full font-mono" />
          </div>
          <div>
            <label className="text-xs text-[var(--pios-muted)] mb-1 block">Primary colour</label>
            <div className="flex gap-2">
              <input type="color" value={form.primary_colour} onChange={e => setForm(p => ({ ...p, primary_colour: e.target.value }))}
                className="h-9 w-12 rounded cursor-pointer border border-[var(--pios-border)] bg-transparent" />
              <input value={form.primary_colour} onChange={e => setForm(p => ({ ...p, primary_colour: e.target.value }))}
                className="pios-input flex-1 font-mono text-xs" />
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--pios-muted)] mb-1 block">Accent colour</label>
            <div className="flex gap-2">
              <input type="color" value={form.accent_colour} onChange={e => setForm(p => ({ ...p, accent_colour: e.target.value }))}
                className="h-9 w-12 rounded cursor-pointer border border-[var(--pios-border)] bg-transparent" />
              <input value={form.accent_colour} onChange={e => setForm(p => ({ ...p, accent_colour: e.target.value }))}
                className="pios-input flex-1 font-mono text-xs" />
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--pios-muted)] mb-1 block">Logo URL</label>
            <input value={form.logo_url ?? ''} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
              placeholder="https://..." className="pios-input w-full" />
          </div>
          <div>
            <label className="text-xs text-[var(--pios-muted)] mb-1 block">Support email</label>
            <input value={form.support_email} onChange={e => setForm(p => ({ ...p, support_email: e.target.value }))}
              placeholder="support@yourdomain.com" className="pios-input w-full" />
          </div>
        </div>
      </div>

      {/* Domain & Persona */}
      <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-4 h-4 text-[var(--academic)]" />
          <span className="text-sm font-semibold">Domain & Defaults</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[var(--pios-muted)] mb-1 block">Custom domain (optional)</label>
            <input value={form.custom_domain ?? ''} onChange={e => setForm(p => ({ ...p, custom_domain: e.target.value }))}
              placeholder="workspace.yourdomain.com" className="pios-input w-full font-mono text-xs" />
            <p className="text-xs text-[var(--pios-muted)] mt-1">Add CNAME → cname.vercel-dns.com in your DNS</p>
          </div>
          <div>
            <label className="text-xs text-[var(--pios-muted)] mb-1 block">Default persona for new users</label>
            <select value={form.default_persona} onChange={e => setForm(p => ({ ...p, default_persona: e.target.value }))}
              className="pios-input w-full capitalize">
              {PERSONAS.map(p => <option key={p} value={p}>{p.replace(/_/g,' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
            className="rounded" />
          <label htmlFor="active" className="text-sm">Operator config active</label>
        </div>
      </div>

      {/* Feature flags */}
      <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[var(--saas)]" />
          <span className="text-sm font-semibold">Feature Flags</span>
          <span className="text-xs text-[var(--pios-muted)] ml-auto">{form.features_enabled.length}/{ALL_FEATURES.length} enabled</span>
        </div>
        {Object.entries(groupedFeatures).map(([group, features]) => (
          <div key={group} className="mb-4 last:mb-0">
            <p className="text-xs font-semibold text-[var(--pios-muted)] uppercase tracking-wide mb-2 capitalize">{group}</p>
            <div className="grid grid-cols-2 gap-2">
              {features.map(f => {
                const enabled = form.features_enabled.includes(f.key)
                return (
                  <button key={f.key} onClick={() => toggleFeature(f.key)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all text-xs ${enabled
                      ? 'bg-green-500/8 border-[rgba(16,185,129,0.2)] text-foreground'
                      : 'bg-muted/20 border-[var(--pios-border)] text-[var(--pios-muted)]'}`}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${enabled ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
