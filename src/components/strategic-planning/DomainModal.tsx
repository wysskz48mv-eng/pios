'use client'
import { useState } from 'react'
const DOMAINS = ['Career','Finance','Health','Relationships','Personal Development','Spirituality','Recreation','Community','Family','Education']
export function DomainModal({ domain, onClose, onCreated }) {
  const [formData, setFormData] = useState({domain_name: domain?.domain_name || '', description: domain?.description || '', color_code: domain?.color_code || '#FF6B6B', priority_rank: domain?.priority_rank || 5})
  const [loading, setLoading] = useState(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const url = domain ? `/api/planning/domains?id=${domain.id}` : '/api/planning/domains'
      const response = await fetch(url, {method: domain ? 'PATCH' : 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(formData)})
      if (response.ok) onCreated()
    } catch (error) { console.error(error) } 
    finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">{domain ? 'Edit' : 'Create'} Domain</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select value={formData.domain_name} onChange={(e) => setFormData({...formData, domain_name: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" disabled={!!domain}>
            <option value="">Select domain...</option>
            {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full border rounded px-3 py-2 text-sm h-20" placeholder="Description" />
          <div><label className="block text-sm mb-2">Priority: {formData.priority_rank}/10</label><input type="range" min="1" max="10" value={formData.priority_rank} onChange={(e) => setFormData({...formData, priority_rank: parseInt(e.target.value)})} className="w-full" /></div>
          <div className="flex gap-3 justify-end"><button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button><button type="submit" disabled={loading || !formData.domain_name} className="px-4 py-2 bg-blue-600 text-white rounded">{loading ? 'Saving...' : domain ? 'Update' : 'Create'}</button></div>
        </form>
      </div>
    </div>
  )
}
