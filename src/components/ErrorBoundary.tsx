'use client'
import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
  moduleName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[PIOS ErrorBoundary] ${this.props.moduleName ?? 'unknown'}:`, error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          padding: '40px 24px', textAlign: 'center' as const,
          background: 'var(--pios-surface)', borderRadius: 12,
          border: '1px solid rgba(239,68,68,0.2)', margin: '24px',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--pios-text)', marginBottom: 8 }}>
            {this.props.moduleName ?? 'Module'} encountered an error
          </div>
          <p style={{ fontSize: 13, color: 'var(--pios-muted)', marginBottom: 16, maxWidth: 400, margin: '0 auto 16px' }}>
            {this.state.error?.message ?? 'Something went wrong loading this module.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)',
              color: '#a78bfa', cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/** Hook-based error display for functional components */
export function ErrorAlert({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null
  return (
    <div className="pios-card" style={{
      borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>⚠</span>
        <span style={{ fontSize: 13, color: '#ef4444' }}>{error}</span>
      </div>
      {onRetry && (
        <button onClick={onRetry} style={{
          padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444', cursor: 'pointer', flexShrink: 0,
        }}>
          Retry
        </button>
      )}
    </div>
  )
}
