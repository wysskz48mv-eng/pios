/**
 * /platform/financials — Group Financial Overview
 * Aggregates expenses, payroll, contracts into a single group P&L view
 * PIOS Sprint 36 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { TrendingUp, Zap, Loader2, RefreshCw, Copy, Check, DollarSign, PiggyBank, FileText, BarChart2 } from 'lucide-react'
import { InvoiceDetailView, type InvoiceDetail } from '@/components/financial/InvoiceDetailView'

type Summary = {
  totalExpensesYTD: number
  payrollYTD: number
  activeContractValue: number
  expByDomain: Record<string, number>
  monthlyBreakdown: Record<string, { expenses: number; payroll: number }>
}
type Contract = { title: string; contract_type: string; counterparty: string; value?: number; currency?: string; end_date?: string }
type InvoiceDashboard = {
  total_invoiced: number
  total_paid: number
  outstanding: number
  overdue: number
  overdue_count: number
  cash_flow_30day: number
  average_collection_days: number
  expenses_this_month: number
  aging: { current: number; days_30: number; days_60: number; days_90_plus: number }
  status_breakdown: Record<string, number>
  recent_invoices: Invoice[]
}
type Invoice = {
  id: string
  invoice_number?: string | null
  invoice_type?: string | null
  client_name?: string | null
  supplier_name?: string | null
  client_email?: string | null
  status?: string | null
  currency?: string | null
  invoice_date?: string | null
  due_date?: string | null
  total_amount: number
  amount_paid: number
  amount_due: number
}
type BrandSettings = {
  company_name?: string | null
  logo_url?: string | null
  primary_color?: string | null
  secondary_color?: string | null
  accent_color?: string | null
  invoice_prefix?: string | null
  next_invoice_number?: number | null
  quote_prefix?: string | null
  next_quote_number?: number | null
  proposal_prefix?: string | null
  next_proposal_number?: number | null
  purchase_order_prefix?: string | null
  next_po_number?: number | null
  receipt_prefix?: string | null
  next_receipt_number?: number | null
  email_from_name?: string | null
  email_from_address?: string | null
  email_reply_to?: string | null
  legal_footer?: string | null
}
type DocumentTemplate = {
  id: string
  name: string
  document_type: string
  is_default?: boolean
  terms_and_conditions?: string | null
  custom_fields?: Array<Record<string, unknown>>
}
type FinancialDocument = {
  id: string
  document_type: string
  document_number: string
  to_name: string
  to_email: string
  status?: string | null
  payment_status?: string | null
  quote_status?: string | null
  proposal_status?: string | null
  issue_date?: string | null
  due_date?: string | null
  valid_until?: string | null
  total_amount: number
  currency?: string | null
}

const DOMAIN_COLOR: Record<string, string> = {
  academic:      'bg-[var(--ai)]/10 text-[var(--ai3)]',
  fm_consulting: 'bg-teal-500/10 text-teal-400',
  saas:          'bg-[var(--academic)]/10 text-[var(--academic)]',
  business:      'bg-[var(--saas)]/10 text-[var(--saas)]',
  personal:      'bg-[var(--pios-surface2)] text-[var(--pios-muted)]',
}

export default function FinancialsPage() {
  const [summary, setSummary]     = useState<Summary | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [invoiceDashboard, setInvoiceDashboard] = useState<InvoiceDashboard | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [brandSettings, setBrandSettings] = useState<BrandSettings | null>(null)
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [documents, setDocuments] = useState<FinancialDocument[]>([])
  const [invoiceFilter, setInvoiceFilter] = useState('all')
  const [loading, setLoading]     = useState(true)
  const [commentary, setComm]     = useState<string | null>(null)
  const [generating, setGen]      = useState(false)
  const [copied, setCopied]       = useState(false)
  const [refreshing, setRefresh]  = useState(false)
  const [savingBrand, setSavingBrand] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [savingDocument, setSavingDocument] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<InvoiceDetail | null>(null)
  const [loadingInvoiceDetail, setLoadingInvoiceDetail] = useState(false)
  const [showSnap, setShowSnap]   = useState(false)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [snapForm, setSnapForm]   = useState({
    period: `${new Date().toLocaleString('en-GB', { month: 'short' })} ${new Date().getFullYear()}`,
    period_type: 'month', revenue: '', expenses: '', payroll_cost: '',
    cash_position: '', receivables: '', payables: '', currency: 'GBP', notes: '',
  })
  const [invoiceForm, setInvoiceForm] = useState({
    to_name: '', to_email: '', description: '', quantity: '1', unit_price: '', payment_terms: 'Net 30',
  })
  const [brandForm, setBrandForm] = useState({
    company_name: '', primary_color: '#0f4c81', secondary_color: '#6b7280', accent_color: '#d97706',
    invoice_prefix: 'INV', quote_prefix: 'QTE', proposal_prefix: 'PROP', purchase_order_prefix: 'PO', receipt_prefix: 'RCP',
    email_from_name: '', email_from_address: '', email_reply_to: '', legal_footer: 'Thank you for your business.',
  })
  const [templateForm, setTemplateForm] = useState({
    document_type: 'invoice', name: '', terms_and_conditions: 'Payment due within 30 days...',
  })
  const [documentForm, setDocumentForm] = useState({
    document_type: 'invoice', to_name: '', to_email: '', description: '', quantity: '1', unit_price: '', template_id: '',
  })

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefresh(true); else setLoading(true)
    try {
      const [groupR, dashboardR, invoicesR, brandR, templatesR, documentsR] = await Promise.all([
        fetch('/api/financials'),
        fetch('/api/financial/dashboard'),
        fetch(`/api/financial/invoices?status=${invoiceFilter}`),
        fetch('/api/financial/brand-settings'),
        fetch('/api/financial/templates'),
        fetch('/api/financial/documents'),
      ])
      const [groupD, dashboardD, invoicesD, brandD, templatesD, documentsD] = await Promise.all([
        groupR.json(), dashboardR.json(), invoicesR.json(), brandR.json(), templatesR.json(), documentsR.json(),
      ])
      setSummary(groupD.summary ?? null)
      setContracts(groupD.contracts ?? [])
      setInvoiceDashboard(dashboardD ?? null)
      setInvoices(invoicesD.invoices ?? [])
      setBrandSettings(brandD ?? null)
      setTemplates(templatesD.templates ?? [])
      setDocuments(documentsD.documents ?? [])
      setBrandForm({
        company_name: brandD?.company_name ?? '',
        primary_color: brandD?.primary_color ?? '#0f4c81',
        secondary_color: brandD?.secondary_color ?? '#6b7280',
        accent_color: brandD?.accent_color ?? '#d97706',
        invoice_prefix: brandD?.invoice_prefix ?? 'INV',
        quote_prefix: brandD?.quote_prefix ?? 'QTE',
        proposal_prefix: brandD?.proposal_prefix ?? 'PROP',
        purchase_order_prefix: brandD?.purchase_order_prefix ?? 'PO',
        receipt_prefix: brandD?.receipt_prefix ?? 'RCP',
        email_from_name: brandD?.email_from_name ?? '',
        email_from_address: brandD?.email_from_address ?? '',
        email_reply_to: brandD?.email_reply_to ?? '',
        legal_footer: brandD?.legal_footer ?? 'Thank you for your business.',
      })
    } catch (err) { console.error('[PIOS]', err) }
    setLoading(false); setRefresh(false)
  }, [invoiceFilter])

  useEffect(() => { load() }, [load])

  async function aiCommentary() {
    if (!summary) return
    setGen(true)
    try {
      const r = await fetch('/api/financials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ai_commentary', summary }) })
      const d = await r.json()
      setComm(d.commentary ?? null)
    } catch (err) { console.error('[PIOS]', err) }
    setGen(false)
  }

  async function saveSnapshot() {
    setSaving(true)
    try {
      const r = await fetch('/api/financials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_snapshot',
          period: snapForm.period, period_type: snapForm.period_type,
          revenue: Number(snapForm.revenue) || 0,
          expenses: Number(snapForm.expenses) || 0,
          payroll_cost: Number(snapForm.payroll_cost) || 0,
          cash_position: Number(snapForm.cash_position) || 0,
          receivables: Number(snapForm.receivables) || 0,
          payables: Number(snapForm.payables) || 0,
          currency: snapForm.currency, notes: snapForm.notes || null,
        }),
      })
      if (r.ok) { setShowSnap(false); load() }
    } catch (err) { console.error('[PIOS]', err) }
    setSaving(false)
  }

  async function createInvoice() {
    setSavingInvoice(true)
    try {
      const quantity = Number(invoiceForm.quantity) || 1
      const unitPrice = Number(invoiceForm.unit_price) || 0
      const r = await fetch('/api/financial/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_name: invoiceForm.to_name,
          to_email: invoiceForm.to_email,
          payment_terms: invoiceForm.payment_terms,
          description: invoiceForm.description,
          items: [{
            description: invoiceForm.description,
            quantity,
            unit_price: unitPrice,
            category: 'Professional Services',
          }],
        }),
      })
      if (r.ok) {
        setInvoiceForm({ to_name: '', to_email: '', description: '', quantity: '1', unit_price: '', payment_terms: 'Net 30' })
        setShowInvoiceForm(false)
        load()
      }
    } catch (err) {
      console.error('[PIOS]', err)
    }
    setSavingInvoice(false)
  }

  async function saveBrandSettings() {
    setSavingBrand(true)
    try {
      const response = await fetch('/api/financial/brand-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandForm),
      })
      if (response.ok) {
        const data = await response.json()
        setBrandSettings(data.updated_settings ?? null)
      }
    } catch (err) {
      console.error('[PIOS]', err)
    }
    setSavingBrand(false)
  }

  async function uploadLogo(file: File) {
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/financial/brand-settings/upload-logo', { method: 'POST', body: formData })
      if (response.ok) {
        const data = await response.json()
        setBrandSettings(current => current ? { ...current, logo_url: data.logo_url } : { logo_url: data.logo_url })
      }
    } catch (err) {
      console.error('[PIOS]', err)
    }
    setUploadingLogo(false)
  }

  async function createTemplate() {
    setSavingTemplate(true)
    try {
      const response = await fetch('/api/financial/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: templateForm.document_type,
          name: templateForm.name,
          is_default: false,
          include_fields: {
            logo: true,
            company_info: true,
            customer_contact: true,
            items: true,
            totals: true,
            terms: true,
          },
          custom_fields: [],
          terms_and_conditions: templateForm.terms_and_conditions,
        }),
      })
      if (response.ok) {
        setTemplateForm({ document_type: 'invoice', name: '', terms_and_conditions: 'Payment due within 30 days...' })
        load(true)
      }
    } catch (err) {
      console.error('[PIOS]', err)
    }
    setSavingTemplate(false)
  }

  async function createDocument() {
    setSavingDocument(true)
    try {
      const quantity = Number(documentForm.quantity) || 1
      const unitPrice = Number(documentForm.unit_price) || 0
      const response = await fetch('/api/financial/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: documentForm.document_type,
          template_id: documentForm.template_id || undefined,
          to_name: documentForm.to_name,
          to_email: documentForm.to_email,
          description: documentForm.description,
          items: [{ description: documentForm.description, quantity, unit_price: unitPrice, tax_rate: 0 }],
        }),
      })
      if (response.ok) {
        setDocumentForm({ document_type: 'invoice', to_name: '', to_email: '', description: '', quantity: '1', unit_price: '', template_id: '' })
        load(true)
      }
    } catch (err) {
      console.error('[PIOS]', err)
    }
    setSavingDocument(false)
  }

  async function openInvoiceDetail(invoiceId: string) {
    setSelectedInvoiceId(invoiceId)
    setLoadingInvoiceDetail(true)
    try {
      const response = await fetch(`/api/financial/invoices/${invoiceId}`)
      const data = await response.json()
      if (response.ok) {
        setSelectedInvoiceDetail(data as InvoiceDetail)
      } else {
        setSelectedInvoiceDetail(null)
      }
    } catch {
      setSelectedInvoiceDetail(null)
    }
    setLoadingInvoiceDetail(false)
  }

  async function refreshInvoiceDetail() {
    await load(true)
    if (!selectedInvoiceId) return
    await openInvoiceDetail(selectedInvoiceId)
  }

  const now = new Date()
  const ytdLabel = `YTD ${now.getFullYear()}`
  const totalBurn = (summary?.totalExpensesYTD ?? 0) + (summary?.payrollYTD ?? 0)
  const months = Object.entries(summary?.monthlyBreakdown ?? {}).sort((a, b) => a[0].localeCompare(b[0]))
  const maxMonthTotal = months.reduce((m, [, v]) => Math.max(m, v.expenses + v.payroll), 1)
  const invoiceStatusButtons = ['all', 'pending', 'approved', 'paid', 'overdue']

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-[var(--fm)]" />
          <div>
            <h1 className="text-xl font-semibold">Group Financial Overview</h1>
            <p className="text-sm text-[var(--pios-muted)]">Aggregated view — expenses · payroll · contracts · cash position</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--pios-border)] text-sm text-[var(--pios-muted)] hover:text-[var(--pios-text)]">
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setShowInvoiceForm(s => !s)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--pios-border)] text-sm text-[var(--pios-muted)] hover:text-[var(--pios-text)]">
            + New invoice
          </button>
          <button onClick={() => setShowSnap(s => !s)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--pios-border)] text-sm text-[var(--pios-muted)] hover:text-[var(--pios-text)]">
            + Add snapshot
          </button>
          <button onClick={aiCommentary} disabled={generating || !summary} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--pios-border)] bg-[rgba(16,185,129,0.1)] text-[var(--fm)] text-sm font-medium hover:bg-green-500/15 disabled:opacity-50">
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            CFO Brief
          </button>
        </div>
      </div>

      {/* Snapshot entry form */}
      {showSnap && (
        <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Add Financial Snapshot</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { label:'Period', key:'period', placeholder:'Mar 2026' },
              { label:'Currency', key:'currency', placeholder:'GBP' },
              { label:'Revenue', key:'revenue', placeholder:'0', type:'number' },
              { label:'Expenses', key:'expenses', placeholder:'0', type:'number' },
              { label:'Payroll cost', key:'payroll_cost', placeholder:'0', type:'number' },
              { label:'Cash position', key:'cash_position', placeholder:'0', type:'number' },
              { label:'Receivables', key:'receivables', placeholder:'0', type:'number' },
              { label:'Payables', key:'payables', placeholder:'0', type:'number' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-[var(--pios-muted)] block mb-1">{f.label}</label>
                <input
                  type={f.type ?? 'text'}
                  value={(snapForm as any)[f.key]}
                  onChange={e => setSnapForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40"
                />
              </div>
            ))}
          </div>
          <div className="mb-3">
            <label className="text-xs text-[var(--pios-muted)] block mb-1">Notes (optional)</label>
            <input
              value={snapForm.notes}
              onChange={e => setSnapForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Any context for this period..."
              className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowSnap(false)} className="px-4 py-2 rounded-lg text-sm text-[var(--pios-muted)] border border-[var(--pios-border)] hover:bg-[var(--pios-surface)]">
              Cancel
            </button>
            <button onClick={saveSnapshot} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-[rgba(16,185,129,0.1)] text-[var(--fm)] border border-[rgba(16,185,129,0.2)] hover:bg-green-500/15 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save snapshot'}
            </button>
          </div>
        </div>
      )}

      {showInvoiceForm && (
        <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Create invoice draft</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { label: 'Client name', key: 'to_name', placeholder: 'Acme Corp' },
              { label: 'Client email', key: 'to_email', placeholder: 'accounts@acme.com' },
              { label: 'Line item description', key: 'description', placeholder: 'Professional Services - April' },
              { label: 'Payment terms', key: 'payment_terms', placeholder: 'Net 30' },
              { label: 'Quantity', key: 'quantity', placeholder: '1', type: 'number' },
              { label: 'Unit price', key: 'unit_price', placeholder: '5000', type: 'number' },
            ].map((field) => (
              <div key={field.key} className={field.key === 'description' ? 'col-span-2' : ''}>
                <label className="text-xs text-[var(--pios-muted)] block mb-1">{field.label}</label>
                <input
                  type={field.type ?? 'text'}
                  value={(invoiceForm as Record<string, string>)[field.key]}
                  onChange={e => setInvoiceForm(current => ({ ...current, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowInvoiceForm(false)} className="px-4 py-2 rounded-lg text-sm text-[var(--pios-muted)] border border-[var(--pios-border)] hover:bg-[var(--pios-surface)]">
              Cancel
            </button>
            <button onClick={createInvoice} disabled={savingInvoice} className="px-4 py-2 rounded-lg text-sm font-medium bg-[rgba(16,185,129,0.1)] text-[var(--fm)] border border-[rgba(16,185,129,0.2)] hover:bg-green-500/15 disabled:opacity-50">
              {savingInvoice ? 'Creating…' : 'Create invoice'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--pios-muted)]" /></div>
      ) : (
        <>
          {/* Financial intelligence */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="text-xs text-[var(--pios-muted)] uppercase tracking-wide mb-2">Total invoiced</div>
              <div className="text-2xl font-semibold">£{(invoiceDashboard?.total_invoiced ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="text-xs text-[var(--pios-muted)] uppercase tracking-wide mb-2">Total paid</div>
              <div className="text-2xl font-semibold">£{(invoiceDashboard?.total_paid ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="text-xs text-[var(--pios-muted)] uppercase tracking-wide mb-2">Outstanding</div>
              <div className="text-2xl font-semibold">£{(invoiceDashboard?.outstanding ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="text-xs text-[var(--pios-muted)] uppercase tracking-wide mb-2">Overdue</div>
              <div className="text-2xl font-semibold">£{(invoiceDashboard?.overdue ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
              <div className="text-xs text-[var(--pios-muted)] mt-1">{invoiceDashboard?.overdue_count ?? 0} invoices</div>
            </div>
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="text-xs text-[var(--pios-muted)] uppercase tracking-wide mb-2">Collection days</div>
              <div className="text-2xl font-semibold">{invoiceDashboard?.average_collection_days ?? 0}</div>
              <div className="text-xs text-[var(--pios-muted)] mt-1">avg paid invoice cycle</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Aged receivables</h3>
                <span className="text-xs text-[var(--pios-muted)]">30-day cash flow: £{(invoiceDashboard?.cash_flow_30day ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  ['Current', invoiceDashboard?.aging.current ?? 0],
                  ['1-30', invoiceDashboard?.aging.days_30 ?? 0],
                  ['31-60', invoiceDashboard?.aging.days_60 ?? 0],
                  ['90+', invoiceDashboard?.aging.days_90_plus ?? 0],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg border border-[var(--pios-border)] bg-[var(--pios-surface2)] p-3">
                    <div className="text-xs text-[var(--pios-muted)] mb-2">{label}</div>
                    <div className="text-lg font-semibold">£{Number(value).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">Invoice status breakdown</h3>
              <div className="space-y-3">
                {Object.entries(invoiceDashboard?.status_breakdown ?? {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between rounded-lg border border-[var(--pios-border)] bg-[var(--pios-surface2)] px-3 py-2">
                    <span className="text-sm capitalize text-[var(--pios-text)]">{status.replace('_', ' ')}</span>
                    <span className="text-sm font-medium text-[var(--pios-muted)]">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-[var(--dng)]" /><span className="text-xs text-[var(--pios-muted)] uppercase tracking-wide">Expenses {ytdLabel}</span></div>
              <div className="text-2xl font-semibold">£{(summary?.totalExpensesYTD ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><PiggyBank className="w-4 h-4 text-[var(--ai3)]" /><span className="text-xs text-[var(--pios-muted)] uppercase tracking-wide">Payroll {ytdLabel}</span></div>
              <div className="text-2xl font-semibold">£{(summary?.payrollYTD ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><BarChart2 className="w-4 h-4 text-[var(--saas)]" /><span className="text-xs text-[var(--pios-muted)] uppercase tracking-wide">Total burn {ytdLabel}</span></div>
              <div className="text-2xl font-semibold">£{totalBurn.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-[var(--academic)]" /><span className="text-xs text-[var(--pios-muted)] uppercase tracking-wide">Contract pipeline</span></div>
              <div className="text-2xl font-semibold">£{(summary?.activeContractValue ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Spend by domain */}
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">Expense breakdown by domain</h3>
              {Object.entries(summary?.expByDomain ?? {}).length === 0 ? (
                <p className="text-xs text-[var(--pios-muted)]">No expenses recorded yet. Add expenses in the Expense Tracker.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(summary?.expByDomain ?? {}).sort((a, b) => b[1] - a[1]).map(([domain, amount]) => {
                    const pct = totalBurn > 0 ? (amount / totalBurn) * 100 : 0
                    return (
                      <div key={domain}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded capitalize ${DOMAIN_COLOR[domain] ?? 'bg-[var(--pios-surface2)] text-[var(--pios-muted)]'}`}>{domain.replace('_', ' ')}</span>
                          <span className="text-sm font-medium">£{amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-[rgba(16,185,129,0.5)] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Monthly trend */}
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">Monthly burn trend</h3>
              {months.length === 0 ? (
                <p className="text-xs text-[var(--pios-muted)]">No monthly data yet. Expenses and payroll will appear here.</p>
              ) : (
                <div className="space-y-2">
                  {months.slice(-6).map(([month, v]) => {
                    const total = v.expenses + v.payroll
                    const pct = (total / maxMonthTotal) * 100
                    return (
                      <div key={month}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-[var(--pios-muted)]">{month}</span>
                          <span className="text-xs font-medium">£{total.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
                          <div className="h-full bg-[rgba(244,63,94,0.5)] rounded-l-full" style={{ width: `${(v.expenses / maxMonthTotal) * 100}%` }} />
                          <div className="h-full bg-[var(--ai)]/50" style={{ width: `${(v.payroll / maxMonthTotal) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex gap-4 pt-1">
                    <span className="flex items-center gap-1 text-xs text-[var(--pios-muted)]"><span className="w-2 h-2 rounded-full bg-[rgba(244,63,94,0.5)] inline-block" />Expenses</span>
                    <span className="flex items-center gap-1 text-xs text-[var(--pios-muted)]"><span className="w-2 h-2 rounded-full bg-[var(--ai)]/50 inline-block" />Payroll</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Invoice register</h3>
                <p className="text-xs text-[var(--pios-muted)]">Basic M056 invoice lifecycle view for finance ops</p>
              </div>
              <div className="flex gap-2">
                {invoiceStatusButtons.map((status) => (
                  <button
                    key={status}
                    onClick={() => setInvoiceFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${invoiceFilter === status
                      ? 'border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.1)] text-[var(--fm)]'
                      : 'border-[var(--pios-border)] text-[var(--pios-muted)] hover:text-[var(--pios-text)]'}`}
                  >
                    {status === 'all' ? 'All' : status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {invoices.length === 0 ? (
              <p className="text-xs text-[var(--pios-muted)]">No invoices match this filter yet.</p>
            ) : (
              <div className="space-y-2">
                {invoices.slice(0, 12).map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between rounded-lg border border-[var(--pios-border)] bg-[var(--pios-surface2)] px-4 py-3">
                    <div>
                      <div className="text-sm font-medium">{invoice.invoice_number ?? 'Draft invoice'} · {invoice.client_name ?? invoice.supplier_name ?? 'Unknown counterparty'}</div>
                      <div className="text-xs text-[var(--pios-muted)]">{invoice.client_email ?? 'No email'} · Due {invoice.due_date ?? '—'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{invoice.currency ?? 'GBP'} {Number(invoice.total_amount ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 2 })}</div>
                      <div className="text-xs text-[var(--pios-muted)] capitalize">{invoice.status ?? 'pending'} · Due {Number(invoice.amount_due ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 2 })}</div>
                      <button
                        onClick={() => openInvoiceDetail(invoice.id)}
                        className="mt-2 text-xs text-[var(--fm)] hover:underline"
                      >
                        View details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedInvoiceId && (
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">Invoice detail</h3>
                  <p className="text-xs text-[var(--pios-muted)]">Payment capture and invoice-level tracking</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedInvoiceId(null)
                    setSelectedInvoiceDetail(null)
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs border border-[var(--pios-border)] text-[var(--pios-muted)] hover:text-[var(--pios-text)]"
                >
                  Close
                </button>
              </div>

              {loadingInvoiceDetail ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[var(--pios-muted)]" /></div>
              ) : selectedInvoiceDetail ? (
                <InvoiceDetailView invoice={selectedInvoiceDetail} onRefresh={refreshInvoiceDetail} />
              ) : (
                <p className="text-xs text-[var(--pios-muted)]">Unable to load invoice detail.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">Brand studio</h3>
                  <p className="text-xs text-[var(--pios-muted)]">Manage document identity, colours, numbering, and sender settings.</p>
                </div>
                <div className="flex items-center gap-3">
                  {brandSettings?.logo_url && (
                    <Image
                      src={brandSettings.logo_url}
                      alt="Brand logo"
                      width={96}
                      height={40}
                      unoptimized
                      className="h-10 w-auto rounded border border-[var(--pios-border)] bg-white p-1"
                    />
                  )}
                  <label className="text-xs text-[var(--pios-muted)] border border-[var(--pios-border)] rounded-lg px-3 py-2 cursor-pointer hover:text-[var(--pios-text)]">
                    {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadLogo(file)
                    }} />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                {[
                  { label: 'Company name', key: 'company_name' },
                  { label: 'From name', key: 'email_from_name' },
                  { label: 'From email', key: 'email_from_address' },
                  { label: 'Reply-to', key: 'email_reply_to' },
                  { label: 'Primary', key: 'primary_color', type: 'color' },
                  { label: 'Secondary', key: 'secondary_color', type: 'color' },
                  { label: 'Accent', key: 'accent_color', type: 'color' },
                  { label: 'Invoice prefix', key: 'invoice_prefix' },
                  { label: 'Quote prefix', key: 'quote_prefix' },
                  { label: 'Proposal prefix', key: 'proposal_prefix' },
                  { label: 'PO prefix', key: 'purchase_order_prefix' },
                  { label: 'Receipt prefix', key: 'receipt_prefix' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-xs text-[var(--pios-muted)] block mb-1">{field.label}</label>
                    <input
                      type={field.type ?? 'text'}
                      value={(brandForm as Record<string, string>)[field.key]}
                      onChange={(e) => setBrandForm(current => ({ ...current, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40"
                    />
                  </div>
                ))}
              </div>
              <div className="mb-3">
                <label className="text-xs text-[var(--pios-muted)] block mb-1">Legal footer</label>
                <textarea
                  value={brandForm.legal_footer}
                  onChange={(e) => setBrandForm(current => ({ ...current, legal_footer: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40"
                />
              </div>
              <div className="flex justify-end">
                <button onClick={saveBrandSettings} disabled={savingBrand} className="px-4 py-2 rounded-lg text-sm font-medium bg-[rgba(16,185,129,0.1)] text-[var(--fm)] border border-[rgba(16,185,129,0.2)] hover:bg-green-500/15 disabled:opacity-50">
                  {savingBrand ? 'Saving…' : 'Save branding'}
                </button>
              </div>
            </div>

            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold">Template manager</h3>
                <p className="text-xs text-[var(--pios-muted)]">Create lightweight branded templates for invoices, quotes, proposals, POs, and receipts.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-[var(--pios-muted)] block mb-1">Document type</label>
                  <select value={templateForm.document_type} onChange={(e) => setTemplateForm(current => ({ ...current, document_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40">
                    {['invoice', 'quote', 'proposal', 'purchase_order', 'receipt'].map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--pios-muted)] block mb-1">Template name</label>
                  <input value={templateForm.name} onChange={(e) => setTemplateForm(current => ({ ...current, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40" />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs text-[var(--pios-muted)] block mb-1">Terms & conditions</label>
                <textarea value={templateForm.terms_and_conditions} onChange={(e) => setTemplateForm(current => ({ ...current, terms_and_conditions: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40" />
              </div>
              <div className="flex justify-end mb-4">
                <button onClick={createTemplate} disabled={savingTemplate || !templateForm.name.trim()} className="px-4 py-2 rounded-lg text-sm font-medium bg-[rgba(16,185,129,0.1)] text-[var(--fm)] border border-[rgba(16,185,129,0.2)] hover:bg-green-500/15 disabled:opacity-50">
                  {savingTemplate ? 'Creating…' : 'Create template'}
                </button>
              </div>
              <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
                {templates.length === 0 ? (
                  <p className="text-xs text-[var(--pios-muted)]">No templates created yet.</p>
                ) : templates.map((template) => (
                  <div key={template.id} className="rounded-lg border border-[var(--pios-border)] bg-[var(--pios-surface2)] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{template.name}</div>
                        <div className="text-xs text-[var(--pios-muted)] capitalize">{template.document_type.replace('_', ' ')}{template.is_default ? ' · default' : ''}</div>
                      </div>
                      <div className="text-xs text-[var(--pios-muted)]">{template.custom_fields?.length ?? 0} custom fields</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Universal documents</h3>
                <p className="text-xs text-[var(--pios-muted)]">Create branded invoices, quotes, proposals, purchase orders, and receipts.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-xs text-[var(--pios-muted)] block mb-1">Document type</label>
                <select value={documentForm.document_type} onChange={(e) => setDocumentForm(current => ({ ...current, document_type: e.target.value, template_id: '' }))} className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40">
                  {['invoice', 'quote', 'proposal', 'purchase_order', 'receipt'].map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--pios-muted)] block mb-1">Recipient</label>
                <input value={documentForm.to_name} onChange={(e) => setDocumentForm(current => ({ ...current, to_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40" />
              </div>
              <div>
                <label className="text-xs text-[var(--pios-muted)] block mb-1">Recipient email</label>
                <input value={documentForm.to_email} onChange={(e) => setDocumentForm(current => ({ ...current, to_email: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[var(--pios-muted)] block mb-1">Description</label>
                <input value={documentForm.description} onChange={(e) => setDocumentForm(current => ({ ...current, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40" />
              </div>
              <div>
                <label className="text-xs text-[var(--pios-muted)] block mb-1">Template</label>
                <select value={documentForm.template_id} onChange={(e) => setDocumentForm(current => ({ ...current, template_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40">
                  <option value="">Default template</option>
                  {templates.filter((template) => template.document_type === documentForm.document_type).map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--pios-muted)] block mb-1">Quantity</label>
                <input type="number" value={documentForm.quantity} onChange={(e) => setDocumentForm(current => ({ ...current, quantity: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40" />
              </div>
              <div>
                <label className="text-xs text-[var(--pios-muted)] block mb-1">Unit price</label>
                <input type="number" value={documentForm.unit_price} onChange={(e) => setDocumentForm(current => ({ ...current, unit_price: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--pios-surface2)] border border-[var(--pios-border2)] text-sm text-[var(--pios-text)] focus:outline-none focus:border-violet-500/40" />
              </div>
            </div>

            <div className="flex justify-end mb-4">
              <button onClick={createDocument} disabled={savingDocument || !documentForm.to_name.trim() || !documentForm.to_email.trim() || !documentForm.description.trim()} className="px-4 py-2 rounded-lg text-sm font-medium bg-[rgba(16,185,129,0.1)] text-[var(--fm)] border border-[rgba(16,185,129,0.2)] hover:bg-green-500/15 disabled:opacity-50">
                {savingDocument ? 'Creating…' : 'Create document'}
              </button>
            </div>

            <div className="space-y-2">
              {documents.length === 0 ? (
                <p className="text-xs text-[var(--pios-muted)]">No branded documents created yet.</p>
              ) : documents.slice(0, 10).map((document) => (
                <div key={document.id} className="flex items-center justify-between rounded-lg border border-[var(--pios-border)] bg-[var(--pios-surface2)] px-4 py-3 gap-4">
                  <div>
                    <div className="text-sm font-medium">{document.document_number} · {document.to_name}</div>
                    <div className="text-xs text-[var(--pios-muted)] capitalize">{document.document_type.replace('_', ' ')} · {document.status ?? 'draft'} · {document.to_email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{document.currency ?? 'GBP'} {Number(document.total_amount ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 2 })}</div>
                    <div className="flex gap-2 justify-end mt-2 text-xs">
                      <a href={`/api/financial/documents/${document.id}/render`} target="_blank" rel="noreferrer" className="text-[var(--ai)] hover:underline">Preview</a>
                      <a href={`/api/financial/documents/${document.id}/pdf`} target="_blank" rel="noreferrer" className="text-[var(--academic)] hover:underline">PDF</a>
                      <button
                        onClick={async () => {
                          await fetch(`/api/financial/documents/${document.id}/send`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ recipient_emails: [document.to_email] }),
                          })
                          load(true)
                        }}
                        className="text-[var(--fm)] hover:underline"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active contracts */}
          {contracts.length > 0 && (
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3">Active contracts</h3>
              <div className="space-y-2">
                {contracts.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--pios-border)] last:border-0">
                    <div>
                      <div className="text-sm font-medium">{c.title}</div>
                      <div className="text-xs text-[var(--pios-muted)]">{c.counterparty} · {c.contract_type}</div>
                    </div>
                    <div className="text-right">
                      {c.value ? <div className="text-sm font-medium">{c.currency ?? 'GBP'} {Number(c.value).toLocaleString()}</div> : <div className="text-xs text-[var(--pios-muted)]">No value</div>}
                      {c.end_date && <div className="text-xs text-[var(--pios-muted)]">Ends {c.end_date}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Commentary */}
          {commentary && (
            <div className="bg-[var(--pios-surface)] border border-[var(--pios-border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-[var(--fm)]" /><span className="text-sm font-semibold text-[var(--fm)]">CFO Commentary — AI Generated</span></div>
                <button onClick={() => { navigator.clipboard.writeText(commentary); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="flex items-center gap-1 text-xs text-[var(--pios-muted)] hover:text-[var(--pios-text)]">
                  {copied ? <Check className="w-3 h-3 text-[var(--fm)]" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs text-[var(--pios-text)]/80 leading-relaxed whitespace-pre-wrap font-sans">{commentary}</pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}
