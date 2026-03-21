import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', user.id).single()

  if (!profile?.google_access_token && !profile?.google_refresh_token) {
    return NextResponse.json({ error: 'Gmail not connected — please sign in with Google', synced: 0 })
  }

  // Auto-refresh if token is expired or within 5-minute buffer
  let accessToken = profile.google_access_token
  if (profile.google_token_expiry) {
    const expiry = new Date(profile.google_token_expiry)
    if (expiry <= new Date(Date.now() + 5 * 60 * 1000) && profile.google_refresh_token) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const refreshRes = await fetch(`${appUrl}/api/auth/refresh-google`, { method: 'POST' })
      if (refreshRes.ok) {
        const { data: fresh } = await supabase.from('user_profiles')
          .select('google_access_token').eq('id', user.id).single()
        accessToken = fresh?.google_access_token ?? accessToken
      }
    }
  }

  if (!accessToken) return NextResponse.json({ error: 'No valid Gmail token. Please reconnect Google.', synced: 0 })

  try {
    const gmailRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=is:unread',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!gmailRes.ok) return NextResponse.json({ error: 'Gmail fetch failed', synced: 0 })
    const { messages = [] } = await gmailRes.json()
    let synced = 0
    for (const msg of messages.slice(0, 10)) {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!detailRes.ok) continue
      const detail = await detailRes.json()
      const headers: Record<string,string> = {}
      detail.payload?.headers?.forEach((h: any) => { headers[h.name] = h.value })
      let triage = { domain:'personal', priority_score:3, action_required:null as string|null, ai_draft_reply:null as string|null }
      try {
        const t = await callClaude([{role:'user',content:`Classify for DBA+FM+SaaS CEO: Subject: ${headers.Subject} From: ${headers.From} Snippet: ${detail.snippet}\nReturn JSON: {"domain":"academic|fm_consulting|saas|business|personal","priority_score":1,"action_required":"or null","ai_draft_reply":"or null"}`}],'Return valid JSON only.',200)
        triage = JSON.parse(t.replace(/```json|```/g,'').trim())
      } catch {}
      await supabase.from('email_items').upsert({
        user_id:user.id, gmail_message_id:msg.id, gmail_thread_id:detail.threadId,
        subject:headers.Subject, sender_name:headers.From?.split('<')[0].trim(),
        sender_email:headers.From?.match(/<(.+)>/)?.[1]||headers.From,
        received_at:new Date(parseInt(detail.internalDate)).toISOString(),
        snippet:detail.snippet, domain_tag:triage.domain, priority_score:triage.priority_score,
        action_required:triage.action_required, ai_draft_reply:triage.ai_draft_reply, status:'triaged',
      },{ onConflict:'gmail_message_id' })
      synced++
    }
    return NextResponse.json({ synced })
  } catch { return NextResponse.json({ error:'Sync failed', synced:0 }) }
}
