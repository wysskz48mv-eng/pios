'use client'

import { useMemo, useState } from 'react'

type InvoiceItem = {
  description?: string
  quantity?: number
  unit_price?: number
  category?: string
}

type PaymentHistoryEntry = {
  amount?: number
  payment_date?: string
  recorded_at?: string
  note?: string | null
  recorded_by?: string | null
}

type InvoiceMetadata = {
  items?: InvoiceItem[]
  payment_terms?: string
  payment_history?: PaymentHistoryEntry[]
  description?: string | null
}

export type InvoiceDetail = {
  id: string
  invoice_number?: string | null
  invoice_type?: string | null
  client_name?: string | null
  client_email?: string | null
  supplier_name?: string | null
  supplier_email?: string | null
  invoice_date?: string | null
  due_date?: string | null
  paid_date?: string | null
  currency?: string | null
  status?: string | null
  subtotal?: number
  tax_amount?: number
  total_amount: number
  amount_paid: number
  amount_due: number
  approval_notes?: string | null
  raw_text?: string | null
}

type InvoiceDetailViewProps = {
  invoice: InvoiceDetail
  onRefresh?: () => Promise<void> | void
}

function toAmount(value: unknown): number {
  return Number(value ?? 0)
}

function formatCurrency(amount: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDisplayDate(value?: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function parseMetadata(rawText?: string | null): InvoiceMetadata {
  if (!rawText) return {}
  try {
    const parsed = JSON.parse(rawText) as InvoiceMetadata
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function InvoiceDetailView({ invoice, onRefresh }: InvoiceDetailViewProps) {
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(invoice.amount_due > 0 ? String(invoice.amount_due) : '')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNote, setPaymentNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const metadata = useMemo(() => parseMetadata(invoice.raw_text), [invoice.raw_text])
  const items = metadata.items ?? []
  const paymentHistory = metadata.payment_history ?? []
  const currency = invoice.currency ?? 'GBP'

  async function recordPayment() {
    setRecordingPayment(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch('/api/financial/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoice.id,
          amount: toAmount(paymentAmount),
          payment_date: paymentDate,
          note: paymentNote,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(String(data?.error ?? 'Failed to record payment'))
        return
      }
      setMessage('Payment recorded successfully.')
      setPaymentNote('')
      if (onRefresh) await onRefresh()
    } catch {
      setError('Failed to record payment')
    }
    setRecordingPayment(false)
  }

  return (
    <section style={{ display: 'grid', gap: 20 }}>
      <div style={{ border: '1px solid #d7e0ea', borderRadius: 18, background: '#fff', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1, color: '#6b7280' }}>Invoice</div>
            <h2 style={{ margin: '8px 0 6px', fontSize: 28, lineHeight: 1.2, color: '#0f172a' }}>{invoice.invoice_number ?? invoice.id}</h2>
            <div style={{ color: '#475569' }}>{invoice.client_name ?? 'Client'}{invoice.client_email ? ` • ${invoice.client_email}` : ''}</div>
          </div>
          <div style={{ minWidth: 220, textAlign: 'right' }}>
            <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{invoice.status ?? 'pending'}</div>
            <div style={{ marginTop: 14, fontSize: 28, fontWeight: 700, color: '#0f172a' }}>{formatCurrency(invoice.amount_due, currency)}</div>
            <div style={{ color: '#6b7280', fontSize: 13 }}>Outstanding balance</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 20 }}>
          <StatCard label="Issued" value={formatDisplayDate(invoice.invoice_date)} />
          <StatCard label="Due" value={formatDisplayDate(invoice.due_date)} />
          <StatCard label="Total" value={formatCurrency(invoice.total_amount, currency)} />
          <StatCard label="Paid" value={formatCurrency(invoice.amount_paid, currency)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 1fr)', gap: 20, alignItems: 'start' }}>
        <div style={{ border: '1px solid #d7e0ea', borderRadius: 18, background: '#fff', padding: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Line items</h3>
          <div style={{ marginTop: 14, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Description</th>
                  <th style={tableHeaderStyle}>Qty</th>
                  <th style={tableHeaderStyle}>Unit</th>
                  <th style={tableHeaderStyle}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '16px 12px', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>No invoice items stored.</td>
                  </tr>
                ) : items.map((item, index) => {
                  const quantity = toAmount(item.quantity ?? 1)
                  const unitPrice = toAmount(item.unit_price ?? 0)
                  return (
                    <tr key={`${item.description}-${index}`}>
                      <td style={tableCellStyle}>{item.description ?? 'Untitled item'}</td>
                      <td style={{ ...tableCellStyle, textAlign: 'right' }}>{quantity}</td>
                      <td style={{ ...tableCellStyle, textAlign: 'right' }}>{formatCurrency(unitPrice, currency)}</td>
                      <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700 }}>{formatCurrency(quantity * unitPrice, currency)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {(metadata.description || invoice.approval_notes) ? (
            <div style={{ marginTop: 18, padding: 16, borderRadius: 14, background: '#f8fafc', color: '#334155', lineHeight: 1.6 }}>
              {metadata.description ?? invoice.approval_notes}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ border: '1px solid #d7e0ea', borderRadius: 18, background: '#fff', padding: 24 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Record payment</h3>
            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              <label style={labelStyle}>
                Amount
                <input style={inputStyle} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} inputMode="decimal" />
              </label>
              <label style={labelStyle}>
                Payment date
                <input style={inputStyle} type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
              </label>
              <label style={labelStyle}>
                Note
                <textarea style={{ ...inputStyle, minHeight: 92, resize: 'vertical' }} value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} />
              </label>
              <button type="button" onClick={recordPayment} disabled={recordingPayment} style={buttonStyle}>
                {recordingPayment ? 'Recording…' : 'Record payment'}
              </button>
              {message ? <div style={{ color: '#166534', fontSize: 14 }}>{message}</div> : null}
              {error ? <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div> : null}
            </div>
          </div>

          <div style={{ border: '1px solid #d7e0ea', borderRadius: 18, background: '#fff', padding: 24 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Payment history</h3>
            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              {paymentHistory.length === 0 ? (
                <div style={{ color: '#64748b' }}>No payments recorded yet.</div>
              ) : paymentHistory.map((payment, index) => (
                <div key={`${payment.payment_date}-${index}`} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong style={{ color: '#0f172a' }}>{formatCurrency(toAmount(payment.amount), currency)}</strong>
                    <span style={{ color: '#64748b', fontSize: 13 }}>{formatDisplayDate(payment.payment_date ?? payment.recorded_at)}</span>
                  </div>
                  {payment.note ? <div style={{ marginTop: 8, color: '#334155' }}>{payment.note}</div> : null}
                  {payment.recorded_by ? <div style={{ marginTop: 6, color: '#64748b', fontSize: 13 }}>Recorded by {payment.recorded_by}</div> : null}
                </div>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid #d7e0ea', borderRadius: 18, background: '#fff', padding: 24 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Terms</h3>
            <div style={{ marginTop: 12, color: '#334155', lineHeight: 1.6 }}>{metadata.payment_terms ?? 'Net 30'}</div>
          </div>
        </div>
      </div>
    </section>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 14, background: '#f8fafc', padding: 14 }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b' }}>{label}</div>
      <div style={{ marginTop: 8, fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{value}</div>
    </div>
  )
}

const tableHeaderStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px',
  borderBottom: '2px solid #cbd5e1',
  color: '#475569',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
}

const tableCellStyle: React.CSSProperties = {
  padding: '12px',
  borderBottom: '1px solid #e2e8f0',
  color: '#0f172a',
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  fontSize: 14,
  color: '#334155',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  padding: '10px 12px',
  fontSize: 14,
  color: '#0f172a',
  background: '#fff',
}

const buttonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: '12px 14px',
  background: '#0f4c81',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}