import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { checkPromptSafety, sanitiseApiResponse, auditLog } from '@/lib/security-middleware'

// ── Typed Supabase response helpers ──────────────────────────────────────────
type SBResult<T> = { data: T | null; error: { message: string } | null }
type SBRow = Record<string, unknown>


export const runtime = 'nodejs'
export const maxDuration = 30

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/calendar?month=YYYY-MM  — fetch events for a month
// POST { action:'sync' }            — sync from Google Calendar
// POST { action:'create', event }   — create event (local or Google)
// POST { action:'update', id, ... } — update event
// POST { action:'delete', id }      — delete event
// POST { action:'ai_brief', id }    — generate pre-meeting AI brief
// ─────────────────────────────────────────────────────────────────────────────

async function getGoogleToken(supabase: any, userId: string): Promise<string | null> {
  const { data: profile } = await supabase.from('user_profiles')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', userId).single()
  if (!profile?.google_access_token) return null
  if (profile.google_token_expiry) {
    const expiry = new Date(profile.google_token_expiry)
    if (expiry <= new Date(Date.now() + 5 * 60 * 1000) && profile.google_refresh_token) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pios-wysskz48mv-engs-projects.vercel.app'
      await fetch(`${appUrl}/api/auth/refresh-google`, { method: 'POST' })
      const { data: fresh } = await supabase.from('user_profiles')
        .select('google_access_token').eq('id', userId).single()
      return fresh?.google_access_token ?? profile.google_access_token
    }
  }
  return profile.google_access_token
}

function classifyDomain(title: string, description: string): string {
  const text = (title + ' ' + (description ?? '')).toLowerCase()
  if (text.match(/dba|thesis|university|supervision|portsmouth|academic|lecture|study/)) return 'academic'
  if (text.match(/qiddiya|ksp|king salman|fm|facilities|veritasedge|consultancy|client|proposal|site visit/)) return 'fm_consulting'
  if (text.match(/investiscript|veritasedge|pios|sprint|deployment|product|saas|dev/)) return 'saas'
  if (text.match(/sustain international|veritasiq|board|company|legal|compliance|payroll|accountant|bank/)) return 'business'
  return 'personal'
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // YYYY-MM
    const view  = searchParams.get('view') ?? 'month'

    let start: Date, end: Date
    if (month) {
      const [y, m] = month.split('-').map(Number)
      start = new Date(y, m - 1, 1)
      end   = new Date(y, m, 1)
    } else if (view === 'week') {
      const now = new Date()
      start = new Date(now); start.setDate(now.getDate() - now.getDay())
      end   = new Date(start); end.setDate(start.getDate() + 7)
    } else {
      // Default: current month
      const now = new Date()
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end   = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    }

    const { data } = await supabase.from('calendar_events')
      .select('*').eq('user_id', user.id)
      .gte('start_time', start.toISOString())
      .lt('start_time', end.toISOString())
      .order('start_time')

    // Also check if Google is connected
    const { data: profile } = await supabase.from('user_profiles')
      .select('google_email, google_access_token').eq('id', user.id).single()

    return NextResponse.json({
      events: data ?? [],
      google_connected: !!profile?.google_access_token,
      google_email: profile?.google_email ?? null,
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action } = body

    // ── Sync from Google Calendar ────────────────────────────────────────────
    if (action === 'sync') {
      const token = await getGoogleToken(supabase, user.id)
      if (!token) return NextResponse.json({ error: 'Google Calendar not connected. Please sign in with Google.', synced: 0 })

      // Fetch next 60 days of events
      const now = new Date()
      const future = new Date(now.getTime() + 60 * 86400000)

      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` + new URLSearchParams({
          timeMin: now.toISOString(),
          timeMax: future.toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '100',
        }),
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (!calRes.ok) {
        const err = await calRes.text()
        return NextResponse.json({ error: `Google Calendar API error: ${calRes.status}`, detail: err, synced: 0 })
      }

      const calData = await calRes.json()
      const items = calData.items ?? []
      let synced = 0

      for (const item of (items as any[])) {
        if (!item.summary) continue
        const startTime = item.start?.dateTime ?? item.start?.date + 'T00:00:00Z'
        const endTime   = item.end?.dateTime   ?? item.end?.date   + 'T23:59:59Z'
        const allDay    = !!item.start?.date && !item.start?.dateTime

        const domain = classifyDomain(item.summary, item.description ?? '')

        await supabase.from('calendar_events').upsert({
          user_id: user.id,
          google_event_id: (item as any)?.id,
          title: item.summary,
          description: item.description ?? null,
          domain,
          start_time: startTime,
          end_time: endTime,
          all_day: allDay,
          location: item.location ?? null,
          attendees: item.attendees?.map((a: Record<string, unknown>) => ({ email: a.email, name: a.displayName })) ?? [],
          google_meet_url: item.hangoutLink ?? null,
          source: 'google',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'google_event_id', ignoreDuplicates: false })
        synced++
      }

      return NextResponse.json({ synced, total: items.length, provider: 'google' })
    }

    // ── Sync from Microsoft Graph Calendar ───────────────────────────────────
    if (action === 'sync_microsoft') {
      const { data: account } = await supabase
        .from('connected_email_accounts')
        .select('ms_access_token, ms_refresh_token, ms_token_expiry')
        .eq('user_id', user.id)
        .eq('provider', 'microsoft')
        .eq('is_active', true)
        .single()

      if (!account?.ms_access_token) {
        return NextResponse.json({ error: 'Microsoft account not connected', synced: 0 })
      }

      const now    = new Date()
      const future = new Date(now.getTime() + 60 * 86400000)

      const msRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarView?` + new URLSearchParams({
          startDateTime: now.toISOString(),
          endDateTime:   future.toISOString(),
          $orderby:      'start/dateTime',
          $top:          '100',
          $select:       'id,subject,bodyPreview,start,end,location,attendees,isOnlineMeeting,onlineMeetingUrl',
        }),
        { headers: { Authorization: `Bearer ${account.ms_access_token}` } }
      )

      if (!msRes.ok) {
        return NextResponse.json({ error: `Microsoft Graph error: ${msRes.status}`, synced: 0 })
      }

      const msData = await msRes.json()
      const items  = msData.value ?? []
      let synced   = 0

      for (const item of (items as any[])) {
        if (!item.subject) continue
        const startTime = item.start?.dateTime ? new Date(item.start.dateTime).toISOString() : null
        const endTime   = item.end?.dateTime   ? new Date(item.end.dateTime).toISOString()   : null
        if (!startTime) continue

        const domain = classifyDomain(item.subject, item.bodyPreview ?? '')

        await supabase.from('calendar_events').upsert({
          user_id:         user.id,
          google_event_id: `ms_${(item as any)?.id}`,  // prefix to avoid collision with Google IDs
          title:           item.subject,
          description:     item.bodyPreview ?? null,
          domain,
          start_time:      startTime,
          end_time:        endTime,
          all_day:         false,
          location:        item.location?.displayName ?? null,
          attendees:       (item.attendees ?? []).map((a: any) => ({
            email: (a.emailAddress as Record<string,string>)?.address,
            name:  (a.emailAddress as Record<string,string>)?.name,
          })),
          google_meet_url: item.onlineMeetingUrl ?? null,
          source:          'microsoft',
          updated_at:      new Date().toISOString(),
        }, { onConflict: 'google_event_id', ignoreDuplicates: false })
        synced++
      }

      return NextResponse.json({ synced, total: items.length, provider: 'microsoft' })
    }

    // ── Create event ─────────────────────────────────────────────────────────
    if (action === 'create') {
      const { event } = body
      if (!event?.title || !event?.start_time) return NextResponse.json({ error: 'title and start_time required' }, { status: 400 })
      const domain = event.domain ?? classifyDomain(event.title, event.description ?? '')
      const { data, error } = await supabase.from('calendar_events').insert({
        ...event,
        user_id: user.id,
        domain,
        source: 'manual',
        end_time: event.end_time ?? new Date(new Date(event.start_time).getTime() + 60 * 60 * 1000).toISOString(),
      }).select().single()
      if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 })
      return NextResponse.json({ event: data })
    }

    // ── Update event ─────────────────────────────────────────────────────────
    if (action === 'update') {
      const { id, ...updates } = body
      delete updates.action
      const { data } = await supabase.from('calendar_events').update({
        ...updates, updated_at: new Date().toISOString()
      }).eq('id', id).eq('user_id', user.id).select().single()
      return NextResponse.json({ event: data })
    }

    // ── Delete event ─────────────────────────────────────────────────────────
    if (action === 'delete') {
      await supabase.from('calendar_events').delete().eq('id', body.id).eq('user_id', user.id)
      return NextResponse.json({ deleted: true })
    }

    // ── AI pre-meeting brief ─────────────────────────────────────────────────
    if (action === 'ai_brief') {
      const { id } = body
      const { data: event } = await supabase.from('calendar_events')
        .select('*').eq('id', id).single()
      if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

      // Fetch relevant tasks and projects for context
      const [tasksR, projectsR] = await Promise.all([
        supabase.from('tasks').select('title, domain, priority, status').eq('user_id', user.id).neq('status', 'done').limit(10),
        supabase.from('projects').select('title, domain, progress').eq('user_id', user.id).eq('status', 'active').limit(5),
      ])

      const context = `Open tasks: ${tasksR.data?.map(t => `${t.title} [${t.priority}]`).join(', ') ?? 'none'}\nActive projects: ${projectsR.data?.map(p => `${p.title} ${p.progress}%`).join(', ') ?? 'none'}`

      const system = `You are PIOS AI generating a pre-meeting brief for the Group CEO of VeritasIQ Technologies Ltd and DBA candidate.
Generate a concise, actionable meeting brief. Plain prose, 3 short paragraphs max. No lists.
Include: what the meeting is about, key things to cover or prepare, any relevant cross-domain context from his current work.`

      const attendeeList = Array.isArray(event.attendees) ? event.attendees.map((a: Record<string, unknown>) => a.email ?? a.name).join(', ') : ''
      const brief = await callClaude([{
        role: 'user',
        content: `Meeting: ${event.title}\nTime: ${new Date(event.start_time).toLocaleString('en-GB')}\nLocation: ${event.location ?? 'Not specified'}\nAttendees: ${attendeeList || 'Not listed'}\nDescription: ${event.description ?? 'None'}\n\nContext:\n${context}`
      }], system, 400)

      await supabase.from('calendar_events').update({ ai_brief: brief, updated_at: new Date().toISOString() }).eq('id', id)
      return NextResponse.json({ brief })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('/api/calendar:', err)
    return apiError(err)
  }
}
