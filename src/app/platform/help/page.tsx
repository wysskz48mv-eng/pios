/**
 * /platform/help — PIOS Help & Quick Reference
 * Keyboard shortcuts, module guide, support links
 * PIOS Sprint 51 | VeritasIQ Technologies Ltd
 */
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, Keyboard, Zap, MessageSquare, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'

const SHORTCUTS = [
  { key: 'Ctrl + K', action: 'Open AI Companion chat' },
  { key: 'G then D', action: 'Go to Dashboard' },
  { key: 'G then T', action: 'Go to Tasks' },
  { key: 'G then E', action: 'Go to Email' },
  { key: 'G then C', action: 'Go to Command Centre' },
  { key: 'G then A', action: 'Go to AI Companion' },
]

const MODULES = [
  {
    group: '⚡ Professional OS',
    colour: '#0d9488',
    items: [
      { name: 'Command Centre', path: '/platform/command', desc: 'Live platform metrics, intelligence feeds, OKR snapshot' },
      { name: 'Executive OS', path: '/platform/executive', desc: 'OKRs, open decisions, stakeholder CRM, board report pack' },
      { name: 'Daily AI Brief', path: '/platform/dashboard', desc: 'Auto-generated 7am brief with tasks, meetings, and priorities' },
      { name: 'Consulting Frameworks', path: '/platform/consulting', desc: '15 NemoClaw™ frameworks — POM™, OAE™, SDL™, CPA™ and more' },
      { name: 'IP Vault', path: '/platform/ip-vault', desc: 'Register trademarks, patents, frameworks. 90-day renewal alerts' },
      { name: 'Contract Register', path: '/platform/contracts', desc: 'Client/supplier contracts, 60-day expiry alerts, AI review' },
      { name: 'Group P&L', path: '/platform/financials', desc: 'Aggregated burn rate, payroll YTD, active contract pipeline' },
      { name: 'SE-MIL Knowledge Base', path: '/platform/knowledge', desc: 'Institutional memory — case studies, market intelligence, lessons' },
      { name: 'Payroll Engine', path: '/platform/payroll', desc: 'Detect, approve, remit, and chase contractor payments' },
      { name: 'Time Sovereignty', path: '/platform/time-sovereignty', desc: 'TSA™ — audit how you spend time vs strategic priorities' },
    ],
  },
  {
    group: '📚 Academic / CPD',
    colour: '#6c8eff',
    items: [
      { name: 'Academic Hub', path: '/platform/academic', desc: 'Thesis tracker, module grades, supervisor sessions, viva prep' },
      { name: 'Learning Hub', path: '/platform/learning', desc: 'CPD tracker, learning journey, journal, study timer' },
      { name: 'Research Hub', path: '/platform/research', desc: 'Academic database search, journal watchlist, CFP tracker' },
    ],
  },
  {
    group: '📡 Intelligence & Comms',
    colour: '#22d3ee',
    items: [
      { name: 'Email AI', path: '/platform/email', desc: 'Gmail triage, action items, receipt capture, thread summaries' },
      { name: 'Meetings', path: '/platform/meetings', desc: 'Meeting notes, AI action items, auto-task promotion' },
      { name: 'Intelligence Feed', path: '/platform/intelligence', desc: 'FM industry, academic, regulatory, and market intelligence' },
      { name: 'Comms Hub', path: '/platform/comms', desc: 'BICA™ — board communications, stakeholder messaging' },
      { name: 'AI Companion', path: '/platform/ai', desc: 'NemoClaw™ AI with full context, persona training, session history' },
    ],
  },
  {
    group: '⚙ Workspace',
    colour: '#a78bfa',
    items: [
      { name: 'Tasks', path: '/platform/tasks', desc: 'Cross-domain task management with AI prioritisation' },
      { name: 'Calendar', path: '/platform/calendar', desc: 'Google Calendar sync, smart scheduling, meeting prep' },
      { name: 'Projects', path: '/platform/projects', desc: 'Project tracking with milestones and progress bars' },
      { name: 'Files', path: '/platform/files', desc: 'File intelligence — scan, classify, and upload documents' },
      { name: 'Expenses', path: '/platform/expenses', desc: 'Expense tracking, receipt capture, billable hours' },
    ],
  },
]

const FAQ = [
  {
    q: 'How do I get my AI Morning Brief?',
    a: 'Your brief is generated automatically at 7am UTC (8am UK BST) and emailed to you if RESEND_API_KEY is set. You can also generate it on-demand from the Dashboard using the "Generate today\'s brief" button.',
  },
  {
    q: 'How do I connect Gmail?',
    a: 'Go to Settings → Integrations → Connect Gmail. You\'ll be prompted for Google OAuth. Once connected, PIOS will triage your inbox, capture receipts, and include email context in your daily brief.',
  },
  {
    q: 'What are NemoClaw™ frameworks?',
    a: '15 proprietary consulting frameworks built by VeritasIQ. They replace BCG, McKinsey, Porter and similar tools with IP-clean equivalents. Access them via Consulting → select a framework → describe your situation.',
  },
  {
    q: 'How do I train the AI to know my context?',
    a: 'Go to AI Companion → scroll down to "Train NemoClaw™". Add your role, company description, current goals, and custom instructions. This context is injected into every AI response.',
  },
  {
    q: 'How do I run the M019/M020 database migrations?',
    a: 'Go to /platform/admin → scroll to the Migrations section → find M019 and M020 in the list → click Run for each. M019 unlocks IP Vault, Contracts, and Group P&L. M020 unlocks the SE-MIL Knowledge Base. After M019 runs, go to /platform/ip-vault and click Seed NemoClaw™ to register all 15 proprietary frameworks.',
  },
  {
    q: 'Why is the admin Run button for M019/M020 failing?',
    a: 'The Run button requires DIRECT_URL or DATABASE_URL to be set in your Vercel environment variables — this is the direct PostgreSQL connection string from Supabase (not the standard API URL). Go to Supabase Dashboard → Settings → Database → Connection String → copy the direct URL and add it as DIRECT_URL in Vercel.',
  },
]

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [openGroup, setOpenGroup] = useState<string | null>('⚡ Professional OS')

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen className="w-6 h-6 text-violet-400" />
        <div>
          <h1 className="text-xl font-semibold">Help & Quick Reference</h1>
          <p className="text-sm text-muted-foreground">Module guide, keyboard shortcuts, and FAQs</p>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <Zap className="w-4 h-4" />, label: 'Run smoke test', href: '/platform/smoke', colour: 'text-green-400' },
          { icon: <MessageSquare className="w-4 h-4" />, label: 'Admin panel', href: '/platform/admin', colour: 'text-amber-400' },
          { icon: <ExternalLink className="w-4 h-4" />, label: 'Setup guide', href: '/platform/setup', colour: 'text-blue-400' },
          { icon: <BookOpen className="w-4 h-4" />, label: 'Settings', href: '/platform/settings', colour: 'text-violet-400' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:bg-card/80 transition-colors no-underline">
            <span className={item.colour}>{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Keyboard shortcuts */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Keyboard className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          <span className="text-xs text-muted-foreground ml-auto">Coming soon — navigation shortcuts</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center gap-3">
              <kbd className="text-xs bg-muted/60 border border-border rounded px-2 py-1 font-mono min-w-[90px] text-center">{s.key}</kbd>
              <span className="text-xs text-muted-foreground">{s.action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Module reference */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Module Reference</h2>
        <div className="space-y-2">
          {MODULES.map(group => (
            <div key={group.group} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenGroup(openGroup === group.group ? null : group.group)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
              >
                <span className="text-sm font-semibold" style={{ color: group.colour }}>{group.group}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{group.items.length} modules</span>
                  {openGroup === group.group
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  }
                </div>
              </button>
              {openGroup === group.group && (
                <div className="border-t border-border">
                  {group.items.map(item => (
                    <Link key={item.path} href={item.path}
                      className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors no-underline">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
              >
                <span className="text-sm font-medium">{item.q}</span>
                {openFaq === i
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                }
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Support */}
      <div className="bg-card border border-border rounded-xl p-5 text-center">
        <p className="text-sm text-muted-foreground">
          Need help?{' '}
          <a href="mailto:support@veritasiq.io" className="text-violet-400 hover:underline">support@veritasiq.io</a>
          {' '}·{' '}
          <a href="https://github.com/wysskz48mv-eng/pios/issues" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">GitHub Issues</a>
        </p>
      </div>

    </div>
  )
}
