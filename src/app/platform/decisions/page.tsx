'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<any[]>([])
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.from('decision_log').select('*').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setDecisions(data ?? []))
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Decisions</h1>
        <p className="text-sm text-zinc-400 mt-1">Track and review your strategic decisions</p>
      </div>
      {decisions.length === 0 ? (
        <div className="border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-500 text-sm">No decisions logged yet.</p>
          <p className="text-zinc-600 text-xs mt-2">Use NemoClaw to log and analyse decisions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {decisions.map((d) => (
            <div key={d.id} className="border border-zinc-800 rounded-lg p-4">
              <p className="text-sm text-white font-medium">{d.title ?? d.decision_text ?? 'Decision'}</p>
              <p className="text-xs text-zinc-500 mt-1">{new Date(d.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
