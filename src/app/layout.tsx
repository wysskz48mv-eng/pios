import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PIOS — Personal Intelligent Operating System',
  description: 'Your AI-powered command centre. Academic, consulting, projects, and business — unified.',
  keywords: ['AI productivity', 'personal OS', 'academic management', 'consulting', 'postgraduate'],
  openGraph: {
    title: 'PIOS — Personal Intelligent Operating System',
    description: 'The AI operating system for multi-domain professionals.',
    url: 'https://pios.sustain-intl.com',
    siteName: 'PIOS',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
