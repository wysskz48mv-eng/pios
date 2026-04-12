'use client'
/**
 * /platform/consulting/proposals/new — NemoClaw™ Proposal Generator
 * AI-drafted proposals in your communication register.
 * Pulls client from stakeholders, pre-fills from your profile.
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const TEMPLATES = [
  { id: 'fm_audit',        label: 'FM Audit + Report',                  desc: 'Facilities management audit and findings report' },
  { id: 'fm_strategy',     label: 'FM Strategy + Roadmap',              desc: 'Strategic FM plan and implementation roadmap' },
  { id: 'fm_implementation', label: 'FM Implementation',               desc: 'Hands-on FM delivery and change management' },
  { id: 'technical_review', label: 'Technical Review',                  desc: 'Asset condition, compliance, or system review' },
  { id: 'service_charge',  label: 'Service Charge Governance',          desc: 'SC framework, benchmarking, and compliance' },
  { id: 'custom',          label: 'Custom Engagement',                  desc: 'Bespoke scope — I will describe it' },
]

export default function NewProposalPage() {
  const router = useRouter()
  const [step, setStep]             = useState<'details' | 'draft' | 'review'>('details')
  const [template, setTemplate]     = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clientId, setClientId]     = useState('')
  const [clientName, setClientName] = useState('')
  const [title, setTitle]           = useState('')
  const [scope, setScope]           = useState('')
  const [dayRate, setDayRate]       = useState('')
  const [days, setDays]             = useState('')
  const [expenses, setExpenses]     = useState('')
  const [drafting, setDrafting]     = useState(false)
  const [draft, setDraft]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const fee = (parseFloat(dayRate) || 0) * (parseInt(days) || 0) + (parseFloat(expenses) || 0)

  const generateDraft = useCallback(async () => {
    if (!title || !scope) { setError('Title and scope are required'); return }
    setError('')
    setDrafting(true)
    setStep('draft')
    try {
      const res = await fetch('/api/consulting/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          client_name: clientName,
          title,
          scope,
          day_rate: parseFloat(dayRate) || 0,
          estimated_days: parseInt(days) || 0,
          expenses: parseFloat(expenses) || 0,
          fee_total: fee,
        }),
      })
      const data = await res.json()
      if (data.content) setDraft(data.content)
      else setDraft('Could not generate draft. Please write manually.')
    } catch {
      setDraft('Generation failed. Please write manually.')
    } finally {
      setDrafting(false)
    }
  }, [template, clientName, title, scope, dayRate, days, expenses, fee])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/consulting/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:      clientId || null,
          title,
          template,
          scope_bullets:  scope.split('\n').filter(Boolean),
          content_md:     draft,
          fee_gbp:        fee || null,
          day_rate:       parseFloat(dayRate) || null,
          estimated_days: parseInt(days) || null,
          status:         'draft',
        }),
      })
      const data = await res.json()
      const proposalId = data?.id ?? data?.proposal?.id
      if (proposalId) router.push(`/platform/consulting/proposals/${proposalId}`)
    } catch {
      setSaving(false)
    }
  }

  const inp = { padding: '10px 12px', border: '1px solid var(--pios-border)', borderRadius: 8, background: 'var(--pios-bg)', color: 'var(--pios-text)', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }
  const label = { fontSize: 12, fontWeight: 500, color: 'var(--pios-muted)', marginBottom: 6, display: 'block' as const }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => router.back()} style={{ fontSize: 12, color: 'var(--pios-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 12 }}>← Back</button>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--pios-text)', margin: 0, letterSpacing: '-0.02em' }}>New proposal</h1>
        <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginTop: 4 }}>NemoClaw™ will draft this in your communication register</div>
      </div>

      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {(['details', 'draft', 'review'] as const).map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: step === s ? 'var(--ai)' : s < step ? 'rgba(139,124,248,0.3)' : 'var(--pios-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: step === s ? '#fff' : 'var(--pios-muted)', fontWeight: 500 }}>{i + 1}</div>
            <span style={{ fontSize: 12, color: step === s ? 'var(--pios-text)' : 'var(--pios-muted)', textTransform: 'capitalize' }}>{s}</span>
            {i < 2 && <div style={{ width: 32, height: 1, background: 'var(--pios-border)' }} />}
          </div>
        ))}
      </div>

      {/* STEP 1 — DETAILS */}
      {step === 'details' && (
        <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '24px' }}>

          {/* Template */}
          <div style={{ marginBottom: 20 }}>
            <label style={label}>Engagement type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TEMPLATES.map(t => (
                <div key={t.id} onClick={() => setTemplate(t.id)} style={{ padding: '10px 12px', border: `1px solid ${template === t.id ? 'var(--ai)' : 'var(--pios-border)'}`, borderRadius: 8, cursor: 'pointer', background: template === t.id ? 'rgba(139,124,248,0.06)' : 'transparent' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)' }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--pios-muted)', marginTop: 2 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Client */}
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Client</label>
            <input
              style={inp}
              placeholder="Search stakeholders or type new client name..."
              value={clientSearch || clientName}
              onChange={e => { setClientSearch(e.target.value); setClientName(e.target.value); setClientId('') }}
            />
          </div>

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Proposal title</label>
            <input style={inp} placeholder="e.g. FM Audit — King Salman Park Phase 2" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {/* Scope */}
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Scope (bullet points — NemoClaw™ will expand)</label>
            <textarea
              style={{ ...inp, minHeight: 120, resize: 'vertical', lineHeight: 1.6 }}
              placeholder={`e.g.\n- Review existing FM contracts and KPI frameworks\n- Benchmark costs against GCC comparable assets\n- Deliver written report with recommendations\n- Present findings to client board`}
              value={scope}
              onChange={e => setScope(e.target.value)}
            />
          </div>

          {/* Fees */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={label}>Day rate (£)</label>
              <input style={inp} type="number" placeholder="e.g. 1500" value={dayRate} onChange={e => setDayRate(e.target.value)} />
            </div>
            <div>
              <label style={label}>Estimated days</label>
              <input style={inp} type="number" placeholder="e.g. 10" value={days} onChange={e => setDays(e.target.value)} />
            </div>
            <div>
              <label style={label}>Expenses estimate (£)</label>
              <input style={inp} type="number" placeholder="e.g. 500" value={expenses} onChange={e => setExpenses(e.target.value)} />
            </div>
          </div>

          {fee > 0 && (
            <div style={{ background: 'rgba(139,124,248,0.06)', border: '1px solid rgba(139,124,248,0.15)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: 'var(--pios-text)' }}>
              Total fee: <strong style={{ color: 'var(--ai)' }}>£{fee.toLocaleString()}</strong>
              {dayRate && days && <span style={{ fontSize: 12, color: 'var(--pios-muted)', marginLeft: 8 }}>({days} days × £{parseInt(dayRate).toLocaleString()}/day{parseFloat(expenses) ? ` + £${parseInt(expenses).toLocaleString()} expenses` : ''})</span>}
            </div>
          )}

          {error && <div style={{ fontSize: 13, color: 'var(--dng)', marginBottom: 12 }}>{error}</div>}

          <button
            onClick={generateDraft}
            style={{ width: '100%', padding: '12px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Generate with NemoClaw™ →
          </button>
        </div>
      )}

      {/* STEP 2 — DRAFT */}
      {step === 'draft' && (
        <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '24px' }}>
          {drafting ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 24, color: 'var(--ai)', marginBottom: 12 }}>✦</div>
              <div style={{ fontSize: 14, color: 'var(--pios-muted)' }}>NemoClaw™ is drafting your proposal in your register...</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pios-text)' }}>AI draft — edit as needed</div>
                <div style={{ fontSize: 12, color: 'var(--ai)' }}>Generated by NemoClaw™</div>
              </div>
              <textarea
                style={{ ...inp, minHeight: 480, resize: 'vertical', lineHeight: 1.7, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                value={draft}
                onChange={e => setDraft(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setStep('review')} style={{ flex: 1, padding: '11px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  Looks good →
                </button>
                <button onClick={generateDraft} style={{ padding: '11px 16px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-muted)', fontSize: 13, cursor: 'pointer' }}>
                  Regenerate
                </button>
                <button onClick={() => setStep('details')} style={{ padding: '11px 16px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-muted)', fontSize: 13, cursor: 'pointer' }}>
                  ← Edit details
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 3 — REVIEW */}
      {step === 'review' && (
        <div style={{ background: 'var(--pios-card)', border: '1px solid var(--pios-border)', borderRadius: 12, padding: '24px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--pios-text)', margin: '0 0 16px' }}>Review before saving</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { l: 'Client',   v: clientName || '—' },
              { l: 'Template', v: TEMPLATES.find(t => t.id === template)?.label ?? 'Custom' },
              { l: 'Title',    v: title },
              { l: 'Fee',      v: fee > 0 ? `£${fee.toLocaleString()}` : 'TBD' },
            ].map(({ l, v }) => (
              <div key={l} style={{ background: 'var(--pios-bg)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--pios-dim)', marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pios-text)' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 20 }}>
            Proposal will be saved as <strong style={{ color: 'var(--pios-text)' }}>draft</strong>.
            You can send it from the proposal page after reviewing.
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{ flex: 1, padding: '12px', background: 'var(--ai)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 500, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : 'Save proposal →'}
            </button>
            <button onClick={() => setStep('draft')} style={{ padding: '12px 16px', background: 'transparent', border: '1px solid var(--pios-border)', borderRadius: 8, color: 'var(--pios-muted)', fontSize: 13, cursor: 'pointer' }}>
              ← Edit draft
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
