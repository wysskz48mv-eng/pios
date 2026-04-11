'use client'
import { useSearchParams } from 'next/navigation'
import { FrameworkLibrary } from '@/components/FrameworkLibrary'

export default function FrameworksPage() {
  const searchParams = useSearchParams()
  const domain = searchParams.get('domain')

  return <FrameworkLibrary domainMode={domain} />
}
