'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewRenewalPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('saas')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [nextRenewal, setNextRenewal] = useState('')
  const [provider, setProvider] = useState('')
  const [status, setStatus] = useState('active')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function saveSubscription(e: React.FormEvent) {
    e.preventDefault()
    if (!name) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/consulting/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          amount: amount ? Number(amount) : null,
          currency,
          billing_cycle: billingCycle,
          next_renewal: nextRenewal || null,
          provider: provider || null,
          status,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? 'Failed to save subscription')
        return
      }

      router.push('/platform/consulting?tab=renewals')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="mb-4 text-xs text-zinc-400 hover:text-zinc-200">Back</button>
      <h1 className="text-2xl font-semibold text-white mb-1">Add Subscription</h1>
      <p className="text-sm text-zinc-400 mb-6">Track renewals and avoid missed cancellation windows.</p>

      <form onSubmit={saveSubscription} className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40 space-y-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
              <option value="saas">SaaS</option>
              <option value="insurance">Insurance</option>
              <option value="vehicle">Vehicle</option>
              <option value="utilities">Utilities</option>
              <option value="rent">Rent</option>
              <option value="membership">Membership</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Provider</label>
            <input value={provider} onChange={e => setProvider(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Amount</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Currency</label>
            <input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Billing cycle</label>
            <select value={billingCycle} onChange={e => setBillingCycle(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="one-off">One-off</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Next renewal</label>
            <input type="date" value={nextRenewal} onChange={e => setNextRenewal(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full min-h-24 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
        </div>

        {error && <div className="text-xs text-red-400">{error}</div>}

        <button type="submit" disabled={saving} className="w-full rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white">
          {saving ? 'Saving...' : 'Save subscription'}
        </button>
      </form>
    </div>
  )
}
