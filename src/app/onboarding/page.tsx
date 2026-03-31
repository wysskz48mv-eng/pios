'use client'
/**
 * /onboarding — PIOS Adaptive Onboarding Wizard
 * 7-screen flow: signup complete → persona → CV → modules → IT policy → integrations → live
 *
 * Design principles:
 * - Zero helpdesk calls: wizard configures the platform for you
 * - CV-driven calibration: upload once, NemoClaw™ activates
 * - Persona-adaptive: module pre-checks change per selection
 * - IT-policy aware: standalone mode for corporate users
 * - All steps skippable except persona selection
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K
 */

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/* ── Types ─────────────────────────────────────────────────── */
type Persona = 'founder' | 'consultant' | 'executive' | 'academic' | 'other'
type DeployMode = 'full' | 'hybrid' | 'standalone'
type ModuleKey =
  | 'command_centre' | 'morning_brief' | 'tasks' | 'okrs' | 'decisions'
  | 'wellness' | 'stakeholders' | 'finance' | 'email_intel' | 'ip_vault'
  | 'hr' | 'content' | 'academic_hub' | 'cpd'

interface ModuleConfig {
  key: ModuleKey
  label: string
  description: string
  alwaysOn?: boolean
}

interface CalibResult {
  seniority?: string
  industry?: string
  employers?: string[]
  frameworks?: number
  summary?: string
}

/* ── Module definitions ─────────────────────────────────────── */
const ALL_MODULES: ModuleConfig[] = [
  { key: 'command_centre', label: 'Command Centre',     description: 'Unified daily intelligence',          alwaysOn: true },
  { key: 'morning_brief',  label: 'Morning Brief',      description: 'AI daily briefing at 07:00',          alwaysOn: true },
  { key: 'tasks',          label: 'Tasks + Projects',   description: 'Priority tasks and project tracking',  alwaysOn: true },
  { key: 'wellness',       label: 'Wellness',           description: 'Daily check-in + NemoClaw™ insight',  alwaysOn: true },
  { key: 'okrs',           label: 'OKRs + Strategy',    description: 'Objectives and key results tracking'  },
  { key: 'decisions',      label: 'Decision Log',       description: 'Open decisions and rationale'         },
  { key: 'stakeholders',   label: 'Stakeholder Map',    description: 'CRM-lite + relationship intelligence' },
  { key: 'finance',        label: 'Finance + Billing',  description: 'Invoices, expenses, P&L'              },
  { key: 'email_intel',    label: 'Email Intelligence', description: 'NemoClaw™ inbox triage'               },
  { key: 'ip_vault',       label: 'IP Vault',           description: 'Contracts, trademarks, documents'     },
  { key: 'cpd',            label: 'CPD Tracker',        description: 'Professional development hours'       },
  { key: 'academic_hub',   label: 'Academic Hub',       description: 'Thesis, supervision, publications'    },
  { key: 'hr',             label: 'HR / Payroll',       description: 'Team management (if team > 2)'        },
  { key: 'content',        label: 'Content Pipeline',   description: 'Episode writing and publishing'       },
]

/* ── Pre-check matrix by persona ───────────────────────────── */
const PERSONA_MODULES: Record<Persona, ModuleKey[]> = {
  founder:    ['command_centre','morning_brief','tasks','wellness','okrs','decisions','stakeholders','finance','email_intel','ip_vault'],
  consultant: ['command_centre','morning_brief','tasks','wellness','decisions','stakeholders','finance','email_intel','ip_vault','cpd'],
  executive:  ['command_centre','morning_brief','tasks','wellness','okrs','decisions','stakeholders','email_intel'],
  academic:   ['command_centre','morning_brief','tasks','wellness','academic_hub','cpd'],
  other:      ['command_centre','morning_brief','tasks','wellness'],
}

/* ── Persona display config ─────────────────────────────────── */
const PERSONAS = [
  { key: 'founder'    as Persona, label: 'Founder / CEO',          desc: 'Building a company or product',          icon: '◈' },
  { key: 'consultant' as Persona, label: 'Consultant / Freelancer', desc: 'Billing clients for expertise',          icon: '◎' },
  { key: 'executive'  as Persona, label: 'Executive / Director',    desc: 'Leading inside an organisation',         icon: '◉' },
  { key: 'academic'   as Persona, label: 'Academic / Researcher',   desc: 'Studying or conducting research',        icon: '◇' },
  { key: 'other'      as Persona, label: 'Other',                   desc: "I'll configure manually",               icon: '○' },
]

/* ── Styles ─────────────────────────────────────────────────── */
const S = {
  page:    { minHeight: '100vh', background: 'var(--pios-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' } as React.CSSProperties,
  card:    { width: '100%', maxWidth: 560, background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 16, padding: '40px 40px 36px' } as React.CSSProperties,
  logo:    { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--pios-text)', marginBottom: 32, letterSpacing: '-0.02em' } as React.CSSProperties,
  steps:   { display: 'flex', gap: 6, marginBottom: 32 } as React.CSSProperties,
  dot:     (active: boolean, done: boolean) => ({ width: 6, height: 6, borderRadius: '50%', background: done ? 'var(--ai)' : active ? 'var(--pios-text)' : 'var(--pios-border)', transition: 'background 0.2s' }) as React.CSSProperties,
  h1:      { fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: '0 0 8px', letterSpacing: '-0.02em' } as React.CSSProperties,
  sub:     { fontSize: 14, color: 'var(--pios-muted)', margin: '0 0 28px', lineHeight: 1.5 } as React.CSSProperties,
  btn:     { width: '100%', padding: '12px 20px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8, transition: 'opacity 0.15s' } as React.CSSProperties,
  btnSec:  { width: '100%', padding: '11px 20px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-muted)', fontSize: 13, cursor: 'pointer', marginTop: 8 } as React.CSSProperties,
  pCard:   (sel: boolean) => ({ padding: '14px 16px', border: `1px solid ${sel ? 'var(--ai)' : 'var(--pios-border)'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, background: sel ? 'rgba(139,124,248,0.06)' : 'transparent', transition: 'all 0.15s' }) as React.CSSProperties,
  mRow:    (checked: boolean, disabled: boolean) => ({ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--pios-border)', opacity: disabled ? 0.4 : 1 }) as React.CSSProperties,
  iCard:   { padding: '14px 16px', border: '1px solid var(--pios-border)', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
}

/* ── Main component ─────────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]               = useState(0)
  const [persona, setPersona]         = useState<Persona | null>(null)
  const [deployMode, setDeployMode]   = useState<DeployMode>('full')
  const [modules, setModules]         = useState<Set<ModuleKey>>(new Set<ModuleKey>(['command_centre','morning_brief','tasks','wellness'] as ModuleKey[]))
  const [calib, setCalib]             = useState<CalibResult | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [uploadErr, setUploadErr]     = useState('')
  const [saving, setSaving]           = useState(false)
  const [completeErr, setCompleteErr] = useState('')
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const TOTAL_STEPS = persona === 'executive' ? 7 : 6

  /* ── Persona selection ───── */
  const selectPersona = (p: Persona) => {
    setPersona(p)
    const preChecked = new Set(PERSONA_MODULES[p]) as Set<ModuleKey>
    // Always-on modules always included
    ALL_MODULES.filter(m => m.alwaysOn).forEach(m => preChecked.add(m.key))
    setModules(preChecked)
  }

  /* ── CV upload ───────────── */
  const handleCV = useCallback(async (file: File) => {
    setUploading(true)
    setUploadErr('')
    try {
      const fd = new FormData()
      fd.append('cv', file)
      const res  = await fetch('/api/cv', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setCalib({
        seniority:  data.calibration?.seniority_level,
        industry:   data.calibration?.primary_industry,
        employers:  data.calibration?.employers?.slice(0, 3),
        frameworks: data.calibration?.recommended_frameworks?.length,
        summary:    data.calibration?.calibration_summary?.slice(0, 120),
      })
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  /* ── Module toggle ───────── */
  const toggleModule = (key: ModuleKey, alwaysOn?: boolean) => {
    if (alwaysOn) return
    setModules(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  /* ── Save + complete ─────── */
  const complete = async () => {
    setSaving(true)
    setCompleteErr('')
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona,
          deploy_mode: deployMode,
          active_modules: Array.from(modules),
          integrations,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCompleteErr(data.error ?? 'Setup failed — please try again.')
        setSaving(false)
        return
      }
      router.push('/platform/dashboard')
    } catch {
      setCompleteErr('Network error — please check your connection and try again.')
      setSaving(false)
    }
  }

  /* ── Step navigation ─────── */
  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => s - 1)

  /* ── Step resolver ───────── */
  // Insert IT policy step (step 4) only for executive persona
  const effectiveStep = (persona === 'executive' && step >= 4) ? step : (step >= 4 ? step + 1 : step)

  /* ── Progress dots ───────── */
  const Dots = () => (
    <div style={S.steps}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} style={S.dot(i === step, i < step)} />
      ))}
    </div>
  )

  /* ══════════════════════════════════════════════════════════
     STEP 0 — WELCOME
  ══════════════════════════════════════════════════════════ */
  if (step === 0) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>PIOS</div>
        <Dots />
        <h1 style={S.h1}>Welcome to your Personal Intelligence OS</h1>
        <p style={S.sub}>
          Let's set up your Command Centre in under 5 minutes.
          NemoClaw™ will calibrate to your profile and have your first
          morning brief ready tomorrow at 07:00.
        </p>
        <div style={{ background: 'rgba(139,124,248,0.06)', border: '1px solid rgba(139,124,248,0.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--pios-text)', fontWeight: 500, marginBottom: 6 }}>What happens next</div>
          {['Tell us who you are — 30 seconds', 'Upload your CV (optional) — 60 seconds', 'Activate your modules — 30 seconds', 'Connect your tools — 2 minutes', 'Command Centre live'].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 13, color: 'var(--pios-muted)' }}>
              <span style={{ color: 'var(--ai)', fontWeight: 500 }}>{i + 1}.</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
        <button style={S.btn} onClick={next}>Get started →</button>
      </div>
    </div>
  )

  /* ══════════════════════════════════════════════════════════
     STEP 1 — PERSONA SELECTION
  ══════════════════════════════════════════════════════════ */
  if (step === 1) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>PIOS</div>
        <Dots />
        <h1 style={S.h1}>What best describes you?</h1>
        <p style={S.sub}>This sets your module defaults. You can change everything later.</p>
        {PERSONAS.map(p => (
          <div key={p.key} style={S.pCard(persona === p.key)} onClick={() => selectPersona(p.key)}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: persona === p.key ? 'rgba(139,124,248,0.12)' : 'var(--pios-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: persona === p.key ? 'var(--ai)' : 'var(--pios-muted)', flexShrink: 0 }}>
              {p.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>{p.label}</div>
              <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginTop: 2 }}>{p.desc}</div>
            </div>
            {persona === p.key && (
              <div style={{ marginLeft: 'auto', color: 'var(--ai)', fontSize: 18 }}>✓</div>
            )}
          </div>
        ))}
        <button style={{ ...S.btn, opacity: persona ? 1 : 0.5 }} onClick={next} disabled={!persona}>
          Continue →
        </button>
      </div>
    </div>
  )

  /* ══════════════════════════════════════════════════════════
     STEP 2 — CV UPLOAD
  ══════════════════════════════════════════════════════════ */
  if (step === 2) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>PIOS</div>
        <Dots />
        <h1 style={S.h1}>Upload your CV</h1>
        <p style={S.sub}>NemoClaw™ reads your CV and calibrates your coaching profile, communication style, and module recommendations automatically.</p>

        {!calib ? (
          <div
            style={{ border: '2px dashed var(--pios-border)', borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 16 }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCV(f) }}
          >
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleCV(f) }} />
            {uploading ? (
              <div style={{ color: 'var(--ai)', fontSize: 14 }}>Extracting your profile... NemoClaw™ is reading your CV</div>
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 10, color: 'var(--pios-muted)' }}>↑</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)', marginBottom: 4 }}>Drop CV here or click to browse</div>
                <div style={{ fontSize: 12, color: 'var(--pios-muted)' }}>PDF, Word, or text — max 10MB</div>
              </>
            )}
            {uploadErr && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--dng)' }}>{uploadErr}</div>}
          </div>
        ) : (
          <div style={{ background: 'rgba(16,217,160,0.06)', border: '1px solid rgba(16,217,160,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fm)', marginBottom: 10 }}>✓ NemoClaw™ calibrated</div>
            {calib.seniority  && <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 4 }}>Seniority: <span style={{ color: 'var(--pios-text)' }}>{calib.seniority}</span></div>}
            {calib.industry   && <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 4 }}>Industry: <span style={{ color: 'var(--pios-text)' }}>{calib.industry}</span></div>}
            {calib.employers  && <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 4 }}>Employers: <span style={{ color: 'var(--pios-text)' }}>{calib.employers.join(', ')}</span></div>}
            {calib.frameworks && <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 4 }}>Frameworks activated: <span style={{ color: 'var(--ai)' }}>{calib.frameworks}</span></div>}
            {calib.summary    && <div style={{ fontSize: 12, color: 'var(--pios-dim)', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>"{calib.summary}..."</div>}
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--pios-dim)', marginBottom: 20 }}>
          We extract: seniority, industry, employers, skills, qualifications. Your CV is never stored as a file — only the extracted profile is saved.
        </div>
        <button style={S.btn} onClick={next}>{calib ? 'Continue →' : 'Continue without CV →'}</button>
        <button style={S.btnSec} onClick={back}>← Back</button>
      </div>
    </div>
  )

  /* ══════════════════════════════════════════════════════════
     STEP 3 — MODULE ACTIVATION
  ══════════════════════════════════════════════════════════ */
  if (step === 3) return (
    <div style={S.page}>
      <div style={{ ...S.card, maxWidth: 600 }}>
        <div style={S.logo}>PIOS</div>
        <Dots />
        <h1 style={S.h1}>Your workspace — pre-configured</h1>
        <p style={S.sub}>Pre-checked for <strong style={{ color: 'var(--pios-text)' }}>{PERSONAS.find(p => p.key === persona)?.label}</strong>. Toggle anything on or off — you can change this any time.</p>

        <div style={{ maxHeight: 380, overflowY: 'auto', marginBottom: 20 }}>
          {ALL_MODULES.map(m => {
            const checked = modules.has(m.key)
            return (
              <div key={m.key} style={S.mRow(checked, !!m.alwaysOn)} onClick={() => toggleModule(m.key, m.alwaysOn)}>
                <div style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${checked ? 'var(--ai)' : 'var(--pios-border)'}`, background: checked ? 'var(--ai)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: m.alwaysOn ? 'default' : 'pointer' }}>
                  {checked && <span style={{ color: '#fff', fontSize: 12, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>
                    {m.label}
                    {m.alwaysOn && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--pios-dim)', fontWeight: 400 }}>always on</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginTop: 2 }}>{m.description}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 12, color: 'var(--pios-dim)', marginBottom: 16 }}>
          {modules.size} modules active · Changes take effect immediately
        </div>
        <button style={S.btn} onClick={next}>Continue with these →</button>
        <button style={S.btnSec} onClick={back}>← Back</button>
      </div>
    </div>
  )

  /* ══════════════════════════════════════════════════════════
     STEP 4 — IT POLICY GATE (Executive only)
  ══════════════════════════════════════════════════════════ */
  if (step === 4 && persona === 'executive') return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>PIOS</div>
        <Dots />
        <h1 style={S.h1}>Does your organisation allow third-party app integrations?</h1>
        <p style={S.sub}>This determines how PIOS connects to your tools. You can change this any time in Settings → Integrations.</p>

        {([
          { mode: 'full'       as DeployMode, label: 'Yes — full integrations',       desc: 'Connect Gmail, M365, Xero, and more. Maximum intelligence.' },
          { mode: 'hybrid'     as DeployMode, label: 'Personal accounts only',        desc: 'Connect personal Gmail + Google Calendar. No corporate systems.' },
          { mode: 'standalone' as DeployMode, label: "No / I'm not sure — standalone", desc: 'Manual entry only. NemoClaw™ works from what you tell it. Zero IT policy conflict.' },
        ] as {mode: DeployMode; label: string; desc: string}[]).map(opt => (
          <div key={opt.mode} style={S.pCard(deployMode === opt.mode)} onClick={() => setDeployMode(opt.mode)}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: deployMode === opt.mode ? 'rgba(139,124,248,0.12)' : 'var(--pios-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: deployMode === opt.mode ? 'var(--ai)' : 'var(--pios-muted)', flexShrink: 0 }}>
              {deployMode === opt.mode ? '●' : '○'}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginTop: 2 }}>{opt.desc}</div>
            </div>
          </div>
        ))}

        {deployMode === 'standalone' && (
          <div style={{ background: 'rgba(16,217,160,0.04)', border: '1px solid rgba(16,217,160,0.15)', borderRadius: 8, padding: '12px 14px', marginTop: 8, fontSize: 12, color: 'var(--pios-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--fm)' }}>Standalone is not a degraded experience.</strong> You get full OKRs, decisions, wellness, stakeholder map, and morning brief — powered entirely by what you enter manually. NemoClaw™ works from context you provide.
          </div>
        )}

        <button style={S.btn} onClick={next}>Continue →</button>
        <button style={S.btnSec} onClick={back}>← Back</button>
      </div>
    </div>
  )

  /* ══════════════════════════════════════════════════════════
     STEP 5 — INTEGRATIONS
  ══════════════════════════════════════════════════════════ */
  const intStep = persona === 'executive' ? 5 : 4
  if (step === intStep) {
    const isStandalone = deployMode === 'standalone'
    const IntCard = ({ id, label, desc, disabled }: { id: string; label: string; desc: string; disabled?: boolean }) => (
      <div style={{ ...S.iCard, opacity: disabled ? 0.35 : 1 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginTop: 2 }}>{desc}</div>
        </div>
        {integrations[id] ? (
          <div style={{ fontSize: 12, color: 'var(--fm)', fontWeight: 500 }}>✓ Connected</div>
        ) : (
          <button
            disabled={disabled}
            onClick={() => !disabled && window.location.assign(`/api/integrations/${id}/connect?redirect=/onboarding`)}
            style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 6, color: 'var(--pios-muted)', fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer' }}
          >
            Connect
          </button>
        )}
      </div>
    )

    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.logo}>PIOS</div>
          <Dots />
          <h1 style={S.h1}>Connect your tools</h1>
          <p style={S.sub}>All optional. Skip any and connect later from Settings → Integrations.</p>

          {isStandalone && (
            <div style={{ background: 'rgba(240,160,48,0.06)', border: '1px solid rgba(240,160,48,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--pios-muted)' }}>
              Standalone mode selected — integrations are disabled. You can enable them later if your IT policy changes.
            </div>
          )}

          <IntCard id="gmail"   label="Gmail"            desc="Email triage — NemoClaw™ processes your inbox"    disabled={isStandalone} />
          <IntCard id="outlook" label="Outlook / M365"   desc="Email + Teams meetings → action items"            disabled={isStandalone} />
          <IntCard id="gcal"    label="Google Calendar"  desc="Meetings → tasks, conflict detection"              disabled={isStandalone && deployMode !== 'hybrid'} />
          <IntCard id="xero"    label="Xero"             desc="Invoices, expenses, bank feeds, VAT"               disabled={isStandalone} />

          <div style={{ fontSize: 12, color: 'var(--pios-dim)', margin: '16px 0' }}>
            All connections use OAuth — PIOS only reads what you authorise. No org-wide permissions, ever.
          </div>
          <button style={S.btn} onClick={next}>Continue →</button>
          <button style={S.btnSec} onClick={back}>← Back</button>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════
     STEP 6 — LIVE
  ══════════════════════════════════════════════════════════ */
  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>PIOS</div>
        <h1 style={{ ...S.h1, marginBottom: 4 }}>Your Command Centre is ready.</h1>
        <p style={{ ...S.sub, marginBottom: 24 }}>NemoClaw™ is calibrated and your workspace is live.</p>

        <div style={{ background: 'rgba(139,124,248,0.06)', border: '1px solid rgba(139,124,248,0.15)', borderRadius: 12, padding: '20px', marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ai)', marginBottom: 12 }}>NemoClaw™ active</div>
          {calib?.seniority  && <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 6 }}>✓ {calib.seniority} profile loaded</div>}
          {calib?.frameworks && <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 6 }}>✓ {calib.frameworks} frameworks activated</div>}
          <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 6 }}>✓ {modules.size} modules active</div>
          <div style={{ fontSize: 13, color: 'var(--pios-muted)' }}>✓ Morning brief scheduled — 07:00 daily</div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 24, lineHeight: 1.6 }}>
          Your first NemoClaw™ Morning Brief will arrive tomorrow at 07:00. You can also generate one now from the Command Centre.
        </div>

        {completeErr && (
          <div style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: 'var(--dng)' }}>
            {completeErr}
          </div>
        )}

        <button
          style={{ ...S.btn, opacity: saving ? 0.7 : 1 }}
          disabled={saving}
          onClick={complete}
        >
          {saving ? 'Setting up...' : 'Go to Command Centre →'}
        </button>
      </div>
    </div>
  )
}
