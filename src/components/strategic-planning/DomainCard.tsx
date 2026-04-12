'use client'
import { useState } from 'react'
import { DomainModal } from './DomainModal'

type Domain = {
  id: string
  domain_name: string
  description?: string
  color_code?: string
  priority_rank?: number
}

type DomainCardProps = {
  domain: Domain
  isSelected: boolean
  onSelect: () => void
  onUpdate: () => void
}

export function DomainCard({ domain, isSelected, onSelect, onUpdate }: DomainCardProps) {
  const [showModal, setShowModal] = useState(false)
  return <>
    <div onClick={onSelect} className={`p-6 rounded-lg border-2 cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <h3 className="text-xl font-bold">{domain.domain_name}</h3>
      <p className="text-sm text-gray-600 mt-2">{domain.description}</p>
      <p className="text-xs text-gray-500 mt-4">Priority: {domain.priority_rank}/10</p>
      <button onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); setShowModal(true) }} className="mt-4 px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm">Edit</button>
    </div>
    {showModal && <DomainModal domain={domain} onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); onUpdate() }} />}
  </>
}
