'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCpdEntryPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [provider, setProvider] = useState('')
  const [category, setCategory] = useState('')
  const [hours, setHours] = useState('1')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [professionalBody, setProfessionalBody] = useState('')
  const [renewalDate, setRenewalDate] = useState('')
  const [certificateUrl, setCertificateUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!title || Number(hours) <= 0) {
      setError('Title and valid hours are required')
      return
    }

    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/consulting/cpd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          provider,
          category,
          hours: Number(hours),
          date: date || null,
          professional_body: professionalBody || null,
          renewal_date: renewalDate || null,
          certificate_url: certificateUrl || null,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? 'Failed to save CPD entry')
        return
      }

      router.push('/platform/consulting?tab=cpd')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="mb-4 text-xs text-zinc-400 hover:text-zinc-200">Back</button>
      <h1 className="text-2xl font-semibold text-white mb-1">Log CPD Entry</h1>
      <p className="text-sm text-zinc-400 mb-6">Track professional development hours and renewal evidence.</p>

      <form onSubmit={saveEntry} className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/40 space-y-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Provider</label>
            <input value={provider} onChange={e => setProvider(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Category</label>
            <input value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Hours</label>
            <input type="number" min="0.25" step="0.25" value={hours} onChange={e => setHours(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Renewal date</label>
            <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Professional body</label>
            <input value={professionalBody} onChange={e => setProfessionalBody(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Certificate URL</label>
            <input value={certificateUrl} onChange={e => setCertificateUrl(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full min-h-24 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
        </div>

        {error && <div className="text-xs text-red-400">{error}</div>}

        <button type="submit" disabled={saving} className="w-full rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white">
          {saving ? 'Saving...' : 'Save CPD entry'}
        </button>
      </form>
    </div>
  )
}
