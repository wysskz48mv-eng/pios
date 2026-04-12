'use client'
import { useEffect, useMemo, useState } from 'react'

type Entry = {
  id: string
  date: string
  hours: number
  description?: string
  billable: boolean
  invoiced: boolean
}

export default function TimesheetLogPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState('1')
  const [description, setDescription] = useState('')
  const [billable, setBillable] = useState(true)
  const [error, setError] = useState('')

  async function loadEntries() {
    setLoading(true)
    try {
      const res = await fetch('/api/consulting/timesheet')
      const data = await res.json()
      setEntries(data.entries ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [])

  const unbilled = useMemo(
    () => entries.filter(e => e.billable && !e.invoiced).reduce((sum, e) => sum + Number(e.hours || 0), 0),
    [entries]
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !hours || Number(hours) <= 0) {
      setError('Date and hours are required')
      return
    }

    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/consulting/timesheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          hours: Number(hours),
          description,
          billable,
          invoiced: false,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? 'Could not save entry')
        return
      }

      setDescription('')
      setHours('1')
      setBillable(true)
      await loadEntries()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Timesheet Log</h1>
        <p className="text-sm text-zinc-400 mt-1">Log and review consulting time entries</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={onSubmit} className="lg:col-span-1 border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
          <h2 className="text-sm font-medium text-zinc-100 mb-4">New entry</h2>

          <label className="block text-xs text-zinc-400 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full mb-3 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />

          <label className="block text-xs text-zinc-400 mb-1">Hours</label>
          <input
            type="number"
            min="0.25"
            max="24"
            step="0.25"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-full mb-3 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />

          <label className="block text-xs text-zinc-400 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you work on?"
            className="w-full mb-3 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 min-h-24"
          />

          <label className="inline-flex items-center gap-2 text-sm text-zinc-300 mb-4">
            <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
            Billable
          </label>

          {error && <div className="mb-3 text-xs text-red-400">{error}</div>}

          <button
            disabled={saving}
            type="submit"
            className="w-full rounded bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white"
          >
            {saving ? 'Saving...' : 'Save entry'}
          </button>

          <div className="mt-4 text-xs text-zinc-400">Unbilled total: <span className="text-zinc-100 font-medium">{unbilled.toFixed(2)}h</span></div>
        </form>

        <div className="lg:col-span-2 border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
          <h2 className="text-sm font-medium text-zinc-100 mb-4">Recent entries</h2>

          {loading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-zinc-500">No entries yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded border border-zinc-800 px-3 py-2 bg-zinc-950/50">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-zinc-400">{new Date(entry.date).toLocaleDateString('en-GB')}</div>
                    <div className="text-sm font-semibold text-indigo-300">{entry.hours}h</div>
                  </div>
                  <div className="mt-1 text-sm text-zinc-100">{entry.description || 'No description'}</div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {entry.billable ? 'Billable' : 'Non-billable'}
                    {entry.invoiced ? ' · Invoiced' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
