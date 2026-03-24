import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PIOS — Personal Intelligent Operating System',
  description: 'Your AI-powered command centre. Academic, consulting, projects, and business — unified.',
  keywords: ['AI productivity', 'personal OS', 'academic management', 'consulting', 'postgraduate'],
  openGraph: {
    title: 'PIOS — Personal Intelligent Operating System',
    description: 'The AI operating system for multi-domain professionals.',
    url: 'https://pios.veritasiq.io',
    siteName: 'PIOS',
  },
}

import { headers } from 'next/headers'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? ''

  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
