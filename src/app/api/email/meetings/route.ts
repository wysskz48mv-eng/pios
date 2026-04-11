/**
 * POST /api/email/meetings
 * Meeting Intelligence — RSVP, conflict detection, change tracking
 *
 * Actions:
 *   detect    — scan email for meeting invite (iCal/ICS)
 *   rsvp      — accept/decline/tentative
 *   conflicts — check calendar for conflicts
 *   changes   — detect updates to existing meetings
 *
 * Flow:
 *   Email arrives with meeting invite
 *   → AI detects it's a meeting (during triage)
 *   → This endpoint extracts details + checks conflicts
 *   → User sees rich RSVP card in inbox
 *   → User clicks Accept → RSVP sent, calendar updated
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'
import { apiError } from '@/lib/api-error'

export const runtime = 'nodejs'

interface MeetingDetails {
  title: string
  organizer: string
  organizer_email: string
  start_time: string
  end_time: string
  location: string | null
  zoom_link: string | null
  attendee_count: number
  description: string | null
  uid: string | null
  is_update: boolean
  is_cancellation: boolean
  changes: { field: string; old_value: string; new_value: string }[]
}

interface ConflictInfo {
  has_conflict: boolean
  conflicting_events: { title: string; start: string; end: string }[]
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action, email_id, response, meeting_uid } = body

    // ── DETECT: Extract meeting details from email ──────────────────────────
    if (action === 'detect') {
      if (!email_id) return NextResponse.json({ error: 'email_id required' }, { status: 400 })

      // Get full email body
      const { data: email } = await supabase
        .from('email_items')
        .select('subject, sender_email, sender_name, body_text, snippet, gmail_message_id')
        .eq('id', email_id)
        .eq('user_id', user.id)
        .single()

      if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })

      // If body not fetched yet, get it
      let emailBody = email.body_text ?? email.snippet ?? ''
      if (!email.body_text && email.gmail_message_id) {
        // Fetch full body from Gmail
        const { data: account } = await supabase
          .from('connected_email_accounts')
          .select('google_access_token_enc, google_token_expiry')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('provider', 'google')
          .limit(1)
          .maybeSingle()

        if (account?.google_access_token_enc) {
          try {
            const res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.gmail_message_id}?format=full`,
              { headers: { Authorization: `Bearer ${account.google_access_token_enc}` } }
            )
            if (res.ok) {
              const msg = await res.json()
              emailBody = extractTextFromPayload(msg.payload) ?? emailBody
            }
          } catch {}
        }
      }

      // AI extraction of meeting details
      const meeting = await extractMeetingDetails(email.subject, email.sender_email, email.sender_name, emailBody)

      if (!meeting) {
        return NextResponse.json({ is_meeting: false })
      }

      // Check for conflicts
      const conflicts = await checkConflicts(supabase, user.id, meeting.start_time, meeting.end_time)

      // Check if this is an update to an existing meeting
      let previousVersion = null
      if (meeting.uid) {
        const { data: existing } = await supabase
          .from('calendar_events')
          .select('title, event_date, start_time, end_time, location')
          .eq('user_id', user.id)
          .eq('meeting_uid', meeting.uid)
          .maybeSingle()

        if (existing) {
          previousVersion = existing
          meeting.is_update = true
        }
      }

      return NextResponse.json({
        is_meeting: true,
        meeting,
        conflicts,
        previous_version: previousVersion,
      })
    }

    // ── RSVP: Accept/Decline/Tentative ──────────────────────────────────────
    if (action === 'rsvp') {
      if (!email_id || !response) return NextResponse.json({ error: 'email_id and response required' }, { status: 400 })
      if (!['accepted', 'declined', 'tentative'].includes(response)) {
        return NextResponse.json({ error: 'response must be accepted, declined, or tentative' }, { status: 400 })
      }

      // Get the email
      const { data: email } = await supabase
        .from('email_items')
        .select('subject, sender_email, gmail_message_id, gmail_thread_id')
        .eq('id', email_id)
        .eq('user_id', user.id)
        .single()

      if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })

      // Extract meeting for calendar
      const meetingData = body.meeting as MeetingDetails | undefined

      if (response === 'accepted' || response === 'tentative') {
        // Add to calendar
        if (meetingData) {
          try {
            await supabase.from('calendar_events').insert({
              user_id: user.id,
              title: meetingData.title,
              event_date: meetingData.start_time?.slice(0, 10),
              start_time: meetingData.start_time,
              end_time: meetingData.end_time,
              event_type: 'meeting',
              location: meetingData.location,
              domain: 'business',
              meeting_uid: meetingData.uid,
              notes: `Organizer: ${meetingData.organizer_email}\n${meetingData.zoom_link ? `Zoom: ${meetingData.zoom_link}` : ''}\nRSVP: ${response}`,
            })
          } catch {}

          // Create reminder tasks
          if (response === 'accepted') {
            const startTime = new Date(meetingData.start_time)
            await supabase.from('tasks').insert({
              user_id: user.id,
              title: `Meeting: ${meetingData.title}`,
              description: `${meetingData.organizer} · ${meetingData.location ?? 'No location'}\n${meetingData.zoom_link ?? ''}`,
              domain: 'business',
              status: 'active',
              priority: 'medium',
              due_date: startTime.toISOString().slice(0, 10),
            })
          }
        }

        // Send RSVP reply via Gmail
        const { data: account } = await supabase
          .from('connected_email_accounts')
          .select('google_access_token_enc, google_refresh_token_enc, email_address')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('provider', 'google')
          .limit(1)
          .maybeSingle()

        if (account?.google_access_token_enc && email.sender_email) {
          const rsvpBody = response === 'accepted'
            ? `I'll be there. Looking forward to it.`
            : response === 'tentative'
            ? `I might be able to attend — I'll confirm closer to the time.`
            : `Unfortunately I won't be able to make this. Please share any notes afterwards.`

          const raw = buildMimeMessage(
            account.email_address,
            email.sender_email,
            `Re: ${email.subject}`,
            rsvpBody,
          )

          await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: { Authorization: `Bearer ${account.google_access_token_enc}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw, threadId: email.gmail_thread_id }),
          }).catch(() => {})
        }

        // Create notification
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'meeting',
          title: `Meeting ${response}: ${meetingData?.title ?? email.subject}`,
          message: `RSVP sent to ${email.sender_email}. ${response === 'accepted' ? 'Event added to calendar.' : ''}`,
          link: '/platform/inbox',
          is_read: false,
        })
      }

      // Update email status
      await supabase.from('email_items').update({
        status: 'actioned',
        action_required: `RSVP: ${response}`,
      }).eq('id', email_id)

      return NextResponse.json({
        ok: true,
        response,
        calendar_updated: response === 'accepted' || response === 'tentative',
        rsvp_sent: true,
      })
    }

    // ── CANCEL: Handle meeting cancellation ─────────────────────────────────
    if (action === 'cancel') {
      if (!meeting_uid) return NextResponse.json({ error: 'meeting_uid required' }, { status: 400 })

      await supabase.from('calendar_events')
        .delete()
        .eq('user_id', user.id)
        .eq('meeting_uid', meeting_uid)

      return NextResponse.json({ ok: true, removed: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[PIOS email/meetings]', err)
    return apiError(err)
  }
}

// ── AI Meeting Extraction ───────────────────────────────────────────────────

async function extractMeetingDetails(
  subject: string, senderEmail: string, senderName: string | null, body: string
): Promise<MeetingDetails | null> {
  const system = `Analyze this email and determine if it contains a meeting invite, meeting update, or meeting cancellation.

If it IS a meeting-related email, return JSON:
{
  "is_meeting": true,
  "title": "<meeting title>",
  "organizer": "<name>",
  "organizer_email": "<email>",
  "start_time": "<ISO 8601>",
  "end_time": "<ISO 8601>",
  "location": "<physical location or null>",
  "zoom_link": "<video call URL or null>",
  "attendee_count": <number>,
  "description": "<brief description>",
  "uid": "<iCal UID if found, else null>",
  "is_update": false,
  "is_cancellation": false,
  "changes": []
}

If it contains "Cancelled" or "Canceled", set is_cancellation: true.
If it contains "Updated" or shows changed details, set is_update: true and populate changes array.
If it is NOT a meeting email, return: {"is_meeting": false}
Return ONLY valid JSON.`

  try {
    const raw = await callClaude(
      [{ role: 'user', content: `Subject: ${subject}\nFrom: ${senderName ?? ''} <${senderEmail}>\n\n${body.slice(0, 3000)}` }],
      system, 600, 'haiku'
    )
    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```/g, '').trim())
    if (!parsed.is_meeting) return null
    return parsed as MeetingDetails
  } catch {
    return null
  }
}

// ── Conflict Detection ──────────────────────────────────────────────────────

async function checkConflicts(supabase: any, userId: string, start: string, end: string): Promise<ConflictInfo> {
  const startDate = start.slice(0, 10)

  const { data: events } = await supabase
    .from('calendar_events')
    .select('title, start_time, end_time, event_date')
    .eq('user_id', userId)
    .eq('event_date', startDate)

  if (!events?.length) return { has_conflict: false, conflicting_events: [] }

  const meetingStart = new Date(start).getTime()
  const meetingEnd = new Date(end).getTime()

  const conflicts = events.filter((e: any) => {
    if (!e.start_time || !e.end_time) return false
    const eStart = new Date(e.start_time).getTime()
    const eEnd = new Date(e.end_time).getTime()
    return eStart < meetingEnd && eEnd > meetingStart
  })

  return {
    has_conflict: conflicts.length > 0,
    conflicting_events: conflicts.map((e: any) => ({
      title: e.title,
      start: e.start_time,
      end: e.end_time,
    })),
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractTextFromPayload(payload: any): string | null {
  if (!payload) return null
  if (payload.body?.data) return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  if (payload.parts) {
    const text = payload.parts.find((p: any) => p.mimeType === 'text/plain')
    if (text?.body?.data) return Buffer.from(text.body.data, 'base64url').toString('utf-8')
    for (const part of payload.parts) {
      if (part.parts) { const n = extractTextFromPayload(part); if (n) return n }
    }
  }
  return null
}

function buildMimeMessage(from: string, to: string, subject: string, body: string): string {
  const msg = [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=utf-8', 'MIME-Version: 1.0', '', body].join('\r\n')
  return Buffer.from(msg).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
