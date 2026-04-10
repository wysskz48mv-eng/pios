/**
 * /platform/admin/operator — White-label operator configuration
 * Owner-only. Manage branding, features, OKR notification prefs.
 * PIOS Sprint 25 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect } from 'react'
import { Settings, Bell, Zap, Shield } from 'lucide-react'

type Operator = {
  operator_name: string; slug: string; logo_url: string
  primary_colour: string; accent_colour: string
  support_email: string; custom_domain: string
  features_enabled: string[]; features_disabled: string[]
  default_persona: string
}
type OKRPrefs = { weekly_digest: boolean; drift_alerts: boolean; digest_day: number; email_address: string }

const ALL_FEATURES = [
  { key: 'executive_os',      label: 'Executive OS (EOSA™)' },
  { key: 'consulting',        label: 'Consulting Strategist (CSA™)' },
  { key: 'time_sovereignty',  label: 'Time Sovereignty (TSA™)' },
  { key: 'comms_hub',         label: 'Comms Hub (BICA™ + SIA™)' },
  { key: 'intelligence',      label: 'Intelligence Feed' },
  { key: 'academic',          label: 'Academic / Learning Hub' },
  { key: 'payroll',           label: 'Payroll & Expenses' },
]

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const inp = "w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] placeholder:text-[var(--pios-muted)] focus:outline-none focus:border-violet-500/40 mb-3"

export default function OperatorPage() {
  const [operator, setOperator]   = useState<Operator | null>(null)
  const [okrPrefs, setOkrPrefs]   = useState<OKRPrefs>({ weekly_digest: true, drift_alerts: true, digest_day: 1, email_address: '' })
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [activeTab, setActiveTab] = useState<'operator'|'notifications'|'migrations'>('notifications')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const r = await fetch('/api/operator')
        const d = await r.json()
        if (d.operator) setOperator(d.operator)
      } catch (err) { console.error('[PIOS]', err) }
      setLoading(false)
    }
    load()
  }, [])

  async function saveOKRPrefs() {
    setSaving(true)
    try {
      await fetch('/api/operator', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_okr_prefs', ...okrPrefs }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) { console.error('[PIOS]', err) }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-[var(--pios-muted)] text-sm animate-pulse">Loading operator config…</div>
    </div>
  )

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-[var(--ai3)]" />
        <h1 className="text-xl font-bold">Platform Configuration</h1>
        <span className="text-xs bg-[var(--ai)]/10 text-[var(--ai3)] border border-violet-500/20 px-2 py-0.5 rounded-full font-medium">Owner</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--pios-surface2)] rounded-lg p-1 w-fit">
        {([['notifications','OKR Notifications'],['operator','White-Label'],['migrations','Migrations']] as const).map(([t,l]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === t ? 'bg-[var(--pios-surface3)] text-[var(--pios-text)]' : 'text-[var(--pios-muted)] hover:text-[var(--pios-text)]'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── NOTIFICATIONS TAB ────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Bell className="w-4 h-4 text-[var(--ai3)]" />
            <h2 className="text-base font-semibold">OKR Email Notifications (PAA™)</h2>
          </div>

          <div className="space-y-4 mb-6">
            <label className="flex items-center justify-between p-4 rounded-xl bg-[var(--pios-surface2)] border border-[var(--pios-border2)] cursor-pointer">
              <div>
                <div className="text-sm font-medium text-[var(--pios-text)]">Weekly OKR Digest</div>
                <div className="text-xs text-[var(--pios-muted)] mt-0.5">Receive a PAA™ OKR pulse every week with health scores and AI commentary</div>
              </div>
              <input type="checkbox" checked={okrPrefs.weekly_digest}
                onChange={e => setOkrPrefs(p => ({...p, weekly_digest: e.target.checked}))}
                className="w-4 h-4 rounded" />
            </label>

            <label className="flex items-center justify-between p-4 rounded-xl bg-[var(--pios-surface2)] border border-[var(--pios-border2)] cursor-pointer">
              <div>
                <div className="text-sm font-medium text-[var(--pios-text)]">Drift Alerts</div>
                <div className="text-xs text-[var(--pios-muted)] mt-0.5">Get notified when an OKR moves to at-risk or off-track status</div>
              </div>
              <input type="checkbox" checked={okrPrefs.drift_alerts}
                onChange={e => setOkrPrefs(p => ({...p, drift_alerts: e.target.checked}))}
                className="w-4 h-4 rounded" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs text-[var(--pios-muted)] uppercase tracking-wide block mb-1">Digest day</label>
              <select value={okrPrefs.digest_day} onChange={e => setOkrPrefs(p => ({...p, digest_day: parseInt(e.target.value)}))}
                className={inp + " appearance-none"}>
                {DAYS.map((d,i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--pios-muted)] uppercase tracking-wide block mb-1">Email override (optional)</label>
              <input className={inp} placeholder="Leave blank to use account email"
                value={okrPrefs.email_address}
                onChange={e => setOkrPrefs(p => ({...p, email_address: e.target.value}))} />
            </div>
          </div>

          <button onClick={saveOKRPrefs} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-[var(--ai)] text-white text-sm font-semibold disabled:opacity-50 hover:bg-[var(--ai)] flex items-center justify-center gap-2">
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Notification Preferences'}
          </button>
        </div>
      )}

      {/* ── WHITE-LABEL TAB ──────────────────────────────────── */}
      {activeTab === 'operator' && (
        <div>
          {operator ? (
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-cyan-400" />
                <h2 className="text-base font-semibold">Operator: {operator.operator_name}</h2>
                <span className="text-xs text-[var(--pios-muted)] font-mono">{operator.slug}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Default persona', operator.default_persona],
                  ['Custom domain', operator.custom_domain || '—'],
                  ['Support email', operator.support_email || '—'],
                  ['Primary colour', operator.primary_colour],
                ].map(([label, value]) => (
                  <div key={label} className="bg-[var(--pios-surface2)] rounded-lg p-3">
                    <div className="text-xs text-[var(--pios-muted)] mb-1">{label}</div>
                    <div className="text-[var(--pios-text)] font-medium">{value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs text-[var(--pios-muted)] uppercase tracking-wide mb-2">Enabled features</div>
                <div className="flex flex-wrap gap-2">
                  {ALL_FEATURES.map(f => (
                    <span key={f.key} className={`text-xs px-3 py-1 rounded-full border font-medium ${
                      operator.features_disabled?.includes(f.key)
                        ? 'bg-red-500/10 text-[var(--dng)] border-red-500/20'
                        : 'bg-green-500/10 text-[var(--fm)] border-green-500/20'
                    }`}>
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-xs text-[var(--pios-muted)]">Operator config is managed at the platform level. Contact VeritasIQ to update branding or feature flags.</p>
            </div>
          ) : (
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-8 text-center text-[var(--pios-muted)]">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No operator configured</p>
              <p className="text-xs mt-1">This is a direct PIOS deployment. White-label operator mode is available for enterprise licensing.</p>
              <a href="mailto:info@veritasiq.io" className="inline-block mt-4 text-xs text-[var(--ai3)] hover:underline">Contact us about white-label licensing →</a>
            </div>
          )}
        </div>
      )}

      {/* ── MIGRATIONS TAB ───────────────────────────────────── */}
      {activeTab === 'migrations' && (
        <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-6">
          <h2 className="text-base font-semibold mb-4">Sprint 22–25 Migrations</h2>
          <p className="text-sm text-[var(--pios-muted)] mb-5">Run these in order from the main admin migrations runner at <a href="/platform/admin" className="text-[var(--ai3)] hover:underline">/platform/admin</a></p>
          <div className="space-y-3">
            {[
              { id: 'M015', file: '015_executive_persona.sql', tables: ['exec_principles','exec_decisions','exec_reviews','exec_okrs','exec_key_results','exec_stakeholders','exec_time_blocks'], sprint: 22 },
              { id: 'M016', file: '016_consulting_decision_time.sql', tables: ['consulting_engagements','exec_decision_analyses','exec_time_audits'], sprint: 23 },
              { id: 'M017', file: '017_sia_bica.sql', tables: ['sia_signal_briefs','bica_comms'], sprint: 24 },
              { id: 'M018', file: '018_operator_whitelabel.sql', tables: ['operator_configs','okr_notification_prefs'], sprint: 25 },
            ].map(m => (
              <div key={m.id} className="flex items-start gap-4 p-4 rounded-xl bg-[var(--pios-surface2)] border border-[var(--pios-border2)]">
                <div className="text-xs font-mono font-bold text-[var(--ai3)] min-w-[36px] mt-0.5">{m.id}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--pios-text)] mb-1">{m.file}</div>
                  <div className="flex flex-wrap gap-1">
                    {m.tables.map(t => (
                      <span key={t} className="text-xs bg-[var(--pios-surface2)] text-[var(--pios-muted)] px-2 py-0.5 rounded font-mono">{t}</span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-[var(--pios-muted)] flex-shrink-0">Sprint {m.sprint}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
