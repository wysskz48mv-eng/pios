'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const FRAMEWORKS = [
  { code: 'SDL', name: 'Strategic Decision Layer', category: 'Strategy' },
  { code: 'POM', name: 'Personal Operating Model', category: 'Executive' },
  { code: 'OAE', name: 'Outcome-Action Engine', category: 'Execution' },
  { code: 'CVDM', name: 'Cross-Value Decision Matrix', category: 'Decision' },
  { code: 'CPA', name: 'Constraints-Priorities-Actions', category: 'Planning' },
  { code: 'UMS', name: 'Uncertainty Management System', category: 'Risk' },
  { code: 'VFO', name: 'Value Flow Optimiser', category: 'Finance' },
  { code: 'CFE', name: 'Cognitive Focus Engine', category: 'Productivity' },
  { code: 'ADF', name: 'Adaptive Decision Framework', category: 'Decision' },
  { code: 'GSM', name: 'Goal-Signal Mapper', category: 'Strategy' },
  { code: 'SPA', name: 'Stakeholder Priority Analyser', category: 'Stakeholders' },
  { code: 'RTE', name: 'Risk-Tension Evaluator', category: 'Risk' },
  { code: 'IML', name: 'Iterative Momentum Loop', category: 'Execution' },
]

export default function FrameworksPage() {
  const [filter, setFilter] = useState('')
  const filtered = FRAMEWORKS.filter(f =>
    f.name.toLowerCase().includes(filter.toLowerCase()) ||
    f.code.toLowerCase().includes(filter.toLowerCase()) ||
    f.category.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Frameworks</h1>
        <p className="text-sm text-zinc-400 mt-1">13 proprietary VeritasIQ analytical frameworks</p>
      </div>
      <input
        type="text"
        placeholder="Search frameworks..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-600 mb-4 outline-none focus:border-zinc-600"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(f => (
          <div key={f.code} className="border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-emerald-400 font-medium">{f.code}™</span>
                <p className="text-sm text-white font-medium mt-0.5">{f.name}</p>
              </div>
              <span className="text-xs text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded">{f.category}</span>
            </div>
            <p className="text-xs text-zinc-600 mt-2">Ask NemoClaw to apply this framework to any challenge.</p>
          </div>
        ))}
      </div>
    </div>
  )
}
