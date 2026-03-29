import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/content/pocket-fm/publish
 * Publishes or updates an approved episode to Pocket FM.
 * 
 * Workflow:
 *   1. Fetch episode from DB (must be status = 'approved')
 *   2. If episode has platform_chapter_id → UPDATE existing
 *   3. If no chapter ID → CREATE new episode on Pocket FM
 *   4. On success → update episode status to 'published', log to publish_log
 * 
 * Pocket FM API endpoints (from reverse-engineered studio flow):
 *   POST https://api.pocketfm.com/v2/audiobook/chapter/create
 *   PUT  https://api.pocketfm.com/v2/audiobook/chapter/update/{chapterId}
 * 
 * Auth: token + uid from user's stored Pocket FM credentials
 * 
 * VeritasIQ Technologies Ltd · Content Pipeline
 */

export const runtime     = 'nodejs'
export const maxDuration = 60

const PFM_BASE = 'https://api.pocketfm.com'

function pfmHeaders(token: string, uid: string) {
  return {
    'Content-Type':   'application/json',
    'Authorization':  `Bearer ${token}`,
    'X-User-Id':      uid,
    'X-Platform':     'web',
    'User-Agent':     'Mozilla/5.0 (compatible; PIOS-ContentPipeline/1.0)',
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { episode_id, series_id } = body as { episode_id: string; series_id?: string }

  // Fetch episode
  const { data: ep, error: epErr } = await supabase
    .from('content_episodes')
    .select('*')
    .eq('id', episode_id)
    .eq('user_id', user.id)
    .single()

  if (epErr || !ep) return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
  if (ep.status !== 'approved') {
    return NextResponse.json({ error: `Episode must be 'approved' to publish. Current status: ${ep.status}` }, { status: 400 })
  }
  if (!ep.manuscript_text) return NextResponse.json({ error: 'Episode has no manuscript text' }, { status: 400 })

  // Fetch series for platform credentials and show ID
  const { data: series } = await supabase
    .from('content_series')
    .select('*')
    .eq('id', series_id ?? ep.series_id)
    .single()

  // Fetch Pocket FM credentials from user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('metadata')
    .eq('id', user.id)
    .single()

  const meta = profile?.metadata as Record<string, string> ?? {}
  const pfmToken = meta.pocket_fm_token ?? process.env.POCKET_FM_TOKEN
  const pfmUid   = meta.pocket_fm_uid   ?? process.env.POCKET_FM_UID

  if (!pfmToken || !pfmUid) {
    return NextResponse.json({
      error: 'Pocket FM credentials not configured. Add pocket_fm_token and pocket_fm_uid to your profile metadata, or set POCKET_FM_TOKEN and POCKET_FM_UID in Vercel env vars.',
      instructions: 'Get your token from Pocket FM Studio → DevTools → Network → any API call → Authorization header'
    }, { status: 503 })
  }

  const title   = ep.title
  const content = ep.manuscript_text
  const wordCount = content.split(/\s+/).length

  let pfmResult: Record<string, unknown> = {}
  let success = false
  let action: 'publish' | 'update' = 'publish'

  try {
    if (ep.platform_chapter_id) {
      // ── UPDATE existing episode ─────────────────────────────────────────
      action = 'update'
      const res = await fetch(`${PFM_BASE}/v2/audiobook/chapter/update/${ep.platform_chapter_id}`, {
        method:  'PUT',
        headers: pfmHeaders(pfmToken, pfmUid),
        body:    JSON.stringify({
          title,
          content,
          chapterId:    ep.platform_chapter_id,
          episodeId:    ep.platform_episode_id,
          wordCount,
          status:       'published',
        }),
      })
      pfmResult = await res.json()
      success   = res.ok
    } else {
      // ── CREATE new episode ──────────────────────────────────────────────
      const showId = series?.platform_series_id
      if (!showId) {
        return NextResponse.json({
          error: 'platform_series_id not set on series record. Add your Pocket FM show ID.',
        }, { status: 400 })
      }

      const res = await fetch(`${PFM_BASE}/v2/audiobook/chapter/create`, {
        method:  'POST',
        headers: pfmHeaders(pfmToken, pfmUid),
        body:    JSON.stringify({
          showId,
          title,
          content,
          episodeNumber: ep.episode_number,
          wordCount,
          status: 'published',
        }),
      })
      pfmResult = await res.json()
      success   = res.ok

      // Save the new chapter ID back to the episode
      if (success && pfmResult.chapterId) {
        await supabase.from('content_episodes').update({
          platform_chapter_id: pfmResult.chapterId as string,
          platform_episode_id: pfmResult.episodeId as string,
        }).eq('id', episode_id)
      }
    }
  } catch (err: unknown) {
    // Network or API error
    await supabase.from('content_publish_log').insert({
      series_id:        series_id ?? ep.series_id,
      episode_id,
      user_id:          user.id,
      action,
      platform:         'pocket_fm',
      success:          false,
      error_message:    err instanceof Error ? err.message : 'Network error',
      platform_response: {},
    })
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }

  if (success) {
    // Update episode status
    await supabase.from('content_episodes').update({
      status:           'published',
      published_text:   content,    // capture what was published
      published_at:     new Date().toISOString(),
      manuscript_matches_published: true,
      updated_at:       new Date().toISOString(),
    }).eq('id', episode_id)

    // Update series published count
    if (series_id) {
      await supabase.rpc('increment_published_episodes', { series_id_param: series_id })
    }
  }

  // Log the publish attempt
  await supabase.from('content_publish_log').insert({
    series_id:         series_id ?? ep.series_id,
    episode_id,
    user_id:           user.id,
    action,
    platform:          'pocket_fm',
    platform_response: pfmResult,
    success,
    error_message:     success ? null : (pfmResult.message as string ?? 'Unknown error'),
  })

  return NextResponse.json({
    success,
    action,
    episode_number:    ep.episode_number,
    platform_response: pfmResult,
    ...(success ? {} : { error: pfmResult.message ?? 'Pocket FM returned an error' }),
  })
}
