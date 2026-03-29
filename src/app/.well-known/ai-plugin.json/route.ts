import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// GET /.well-known/ai-plugin.json
// Agent discovery manifest for Claude for Chrome and AI agents
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios.veritasiq.io'

  return NextResponse.json({
    schema_version: 'v1',
    name_for_human: 'PIOS — Personal Intelligent Operating System',
    name_for_model: 'pios',
    description_for_human: 'Your AI-powered personal operating system. Manage tasks, emails, meetings, expenses, academic progress, and more.',
    description_for_model: `PIOS is the Personal Intelligence OS — built for founders, executives, and senior consultants managing multiple high-stakes workstreams.
Use /api/claude-context to get a full live snapshot of tasks, calendar, thesis progress, emails, and expenses.
Key actions: create tasks (POST /api/tasks), sync email (POST /api/email/sync), log expenses (POST /api/expenses),
create meeting notes with AI extraction (POST /api/meetings with auto_process:true), get daily brief (GET /api/brief).
All operations are scoped to the authenticated user via Supabase session cookie.`,
    auth: {
      type: 'user_http',
      authorization_type: 'bearer',
    },
    api: {
      type: 'openapi',
      url: `${appUrl}/api/claude-context`,
    },
    logo_url: `${appUrl}/favicon.svg`,
    contact_email: 'info@veritasiq.io',
    legal_info_url: `${appUrl}/`,
  })
}
