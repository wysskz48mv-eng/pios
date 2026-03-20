import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatRelative(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 0 && diff < 7) return `In ${diff} days`
  if (diff < 0 && diff > -7) return `${Math.abs(diff)} days ago`
  return formatDate(date)
}

export function priorityColour(p: string) {
  return { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }[p] ?? '#6b7280'
}

export function domainColour(d: string) {
  return {
    academic: '#6c8eff', fm_consulting: '#2dd4a0',
    saas: '#f59e0b', business: '#e05a7a', personal: '#a78bfa'
  }[d] ?? '#6b7280'
}

export function domainLabel(d: string) {
  return {
    academic: 'Academic', fm_consulting: 'FM Consulting',
    saas: 'SaaS', business: 'Business', personal: 'Personal'
  }[d] ?? d
}
