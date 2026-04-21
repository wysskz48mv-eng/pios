import type { Metadata } from 'next'
import { DM_Mono, DM_Sans, Cormorant_Garamond, Instrument_Serif } from 'next/font/google'
import './globals.css'
import CookieNotice from '@/components/CookieNotice'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
})
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'PIOS — Personal Intelligent Operating System',
  description: 'Your AI-powered command centre. Academic, consulting, projects, and business — unified.',
  keywords: ['AI productivity', 'personal OS', 'academic management', 'consulting', 'postgraduate'],
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'PIOS — Personal Intelligent Operating System',
    description: 'The AI operating system for multi-domain professionals.',
    url: 'https://pios.veritasiq.io',
    siteName: 'PIOS',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${dmMono.variable} ${cormorant.variable} ${instrumentSerif.variable}`}>
        {children}
        <CookieNotice />
      </body>
    </html>
  )
}
