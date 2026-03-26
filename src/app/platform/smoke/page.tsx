'use client'
/**
 * /platform/smoke — PIOS Platform Smoke Test
 * Runs 12 checks across DB, AI, email, cron, and billing.
 * PIOS v3.0 | Sprint 58 | VeritasIQ Technologies Ltd
 */
import { useState, useCallback } from 'react'
import Link from 'next/link'

interface Check {
  id: string
  name: string
  status: 'pass' | 'fail' | 'warn' | 'skip' | 'running' | 'idle'
  latency_ms: number
  detail: string
  critical: boolean
}

interface SmokeResult {
  ok: boolean
  status: 'healthy' | 'degraded' | 'critical'
  summary: string
  critical_fails: string[]
  checks: Check[]
  timestamp: string
  version: string
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pass:    { bg: 'rgba(34,197,94,0.1)',   text: 'var(--fm)', dot: 'var(--fm)', label: 'PASS' },
  fail:    { bg: 'rgba(239,68,68,0.1)',   text: 'var(--dng)', dot: 'var(--dng)', label: 'FAIL' },
  warn:    { bg: 'rgba(245,158,11,0.1)',  text: 'var(--saas)', dot: 'var(--saas)', label: 'WARN' },
  skip:    { bg: 'rgba(107,114,128,0.1)', text: '#6b7280', dot: '#6b7280', label: 'SKIP' },
  running: { bg: 'var(--ai-subtle)', text: 'var(--ai)', dot: 'var(--ai)', label: '…' },
  idle:    { bg: 'rgba(107,114,128,0.06)', text: '#9ca3af', dot: '#d1d5db', label: '—' },
}

export default function SmokePage() {
  const [result, setResult]   = useState<SmokeResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const run = useCallback(async () => {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/health/smoke')
      const data = await res.json()
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setRunning(false)
    }
  }, [])

  const checks = result?.checks ?? []
  const passCount    = checks.filter(c => c.status === 'pass').length
  const warnCount    = checks.filter(c => c.status === 'warn').length
  const failCount    = checks.filter(c => c.status === 'fail').length
  const criticalFail = checks.some(c => c.critical && c.status === 'fail')

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', paddingBottom: 48 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Platform Smoke Test</h1>
            <p style={{ fontSize: 13, color: 'var(--pios-muted)', margin: 0 }}>
              12 checks · DB · AI · email · cron · billing · PIOS v2.4
            </p>
          </div>
          <button
            onClick={run}
            disabled={running}
            style={{
              padding: '10px 24px', borderRadius: 8, fontWeight: 600, fontSize: 13,
              background: running ? 'rgba(139,124,248,0.2)' : 'var(--ai)',
              color: running ? 'var(--ai)' : '#fff',
              border: `1px solid ${running ? 'rgba(167,139,250,0.3)' : 'transparent'}`,
              cursor: running ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}
          >
            {running ? '⏳ Running checks…' : result ? '↻ Re-run' : '▶ Run Smoke Test'}
          </button>
        </div>

        {/* Result banner */}
        {result && (
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 8, display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            background: criticalFail ? 'rgba(239,68,68,0.08)' : warnCount > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
            border: `1px solid ${criticalFail ? 'rgba(239,68,68,0.25)' : warnCount > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{criticalFail ? '🔴' : warnCount > 0 ? '🟡' : '🟢'}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: criticalFail ? 'var(--dng)' : warnCount > 0 ? 'var(--saas)' : 'var(--fm)' }}>
                  {criticalFail ? 'CRITICAL FAILURE' : warnCount > 0 ? 'DEGRADED' : 'ALL SYSTEMS GO'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginTop: 1 }}>{result.summary}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--pios-dim)', textAlign: 'right' }}>
              <div>{new Date(result.timestamp).toLocaleString('en-GB')}</div>
              <div>PIOS {result.version}</div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--dng)', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Checks list */}
      {!result && !running && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--pios-dim)', fontSize: 13 }}>
          Click <strong style={{ color: 'var(--ai)' }}>Run Smoke Test</strong> to verify all platform subsystems.
        </div>
      )}

      {running && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--pios-muted)', fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
          Running 12 checks across database, AI engine, email, and billing…
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {result.checks.map(check => {
            const s = STATUS_STYLES[check.status] ?? STATUS_STYLES.idle
            return (
              <div key={check.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px', borderRadius: 8,
                background: s.bg, border: `1px solid ${s.text}22`,
              }}>
                {/* Status dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: s.dot,
                  flexShrink: 0, marginTop: 5,
                  boxShadow: check.status === 'fail' ? `0 0 6px ${s.dot}` : 'none',
                }} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{check.name}</span>
                    {check.critical && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: 'rgba(239,68,68,0.15)', color: 'var(--dng)' }}>
                        CRITICAL
                      </span>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 700, color: s.text, marginLeft: 'auto', fontFamily: 'monospace' }}>
                      {s.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--pios-muted)', marginTop: 3 }}>{check.detail}</div>
                </div>

                {/* Latency */}
                <div style={{ fontSize: 11, color: 'var(--pios-dim)', flexShrink: 0, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                  {check.latency_ms}ms
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Actions after failure */}
      {result && (failCount > 0 || warnCount > 0) && (
        <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 8, background: 'var(--pios-surface)', border: '1px solid var(--pios-border)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Recommended actions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.checks.filter(c => c.status === 'fail' || c.status === 'warn').map(c => (
              <div key={c.id} style={{ fontSize: 12, color: 'var(--pios-muted)', display: 'flex', gap: 8 }}>
                <span style={{ color: c.status === 'fail' ? 'var(--dng)' : 'var(--saas)', flexShrink: 0 }}>
                  {c.status === 'fail' ? '✗' : '⚠'}
                </span>
                <span><strong style={{ color: 'var(--pios-text)' }}>{c.name}:</strong> {c.detail}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/platform/setup" style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, background: 'var(--ai-subtle)', color: 'var(--ai)', textDecoration: 'none', fontWeight: 600 }}>
              → Setup Guide
            </Link>
            <Link href="/platform/admin" style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, background: 'rgba(107,114,128,0.1)', color: 'var(--pios-muted)', textDecoration: 'none' }}>
              → Admin Panel
            </Link>
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--pios-dim)', textAlign: 'center', marginTop: 24 }}>
        PIOS v2.4 · Sprint 58 · VeritasIQ Technologies Ltd
      </p>
    </div>
  )
}
