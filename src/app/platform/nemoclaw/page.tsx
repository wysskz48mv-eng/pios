'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function NemoClawPage() {
  const router = useRouter()
  // NemoClaw lives at /platform/ai — redirect there
  useEffect(() => { router.replace('/platform/ai') }, [router])
  return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <p className="text-zinc-500 text-sm">Redirecting to NemoClaw™...</p>
    </div>
  )
}
