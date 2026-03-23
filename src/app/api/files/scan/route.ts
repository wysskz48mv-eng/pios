import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/files/scan
// Scans Google Drive, classifies files with AI, stores in file_items table.
// Applies filing rules to route files to correct spaces.
// Never deletes or moves files — read-only scan + classification.
//
// body: { folder_id?: string, max_files?: number, apply_rules?: boolean }
// ─────────────────────────────────────────────────────────────────────────────

async function getGoogleToken(supabase: any, userId: string): Promise<string | null> {
  const { data: profile } = await supabase.from('user_profiles')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', userId).single()

  if (!profile?.google_access_token) return null

  // Refresh if needed
  if (profile.google_token_expiry) {
    const expiry = new Date(profile.google_token_expiry)
    if (expiry <= new Date(Date.now() + 5 * 60 * 1000) && profile.google_refresh_token) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      await fetch(`${appUrl}/api/auth/refresh-google`, { method: 'POST' })
      const { data: fresh } = await supabase.from('user_profiles')
        .select('google_access_token').eq('id', userId).single()
      return fresh?.google_access_token ?? null
    }
  }
  return profile.google_access_token
}

async function listDriveFiles(token: string, folderId = 'root', maxFiles = 50): Promise<any[]> {
  const query = folderId === 'root'
    ? `mimeType != 'application/vnd.google-apps.folder' and trashed = false`
    : `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`

  const url = `https://www.googleapis.com/drive/v3/files?` + new URLSearchParams({
    q: query,
    fields: 'files(id,name,mimeType,size,webViewLink,createdTime,modifiedTime,parents)',
    pageSize: String(Math.min(maxFiles, 100)),
    orderBy: 'modifiedTime desc',
  })

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Drive API error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.files ?? []
}

async function listDriveFolders(token: string, parentId = 'root'): Promise<any[]> {
  const url = `https://www.googleapis.com/drive/v3/files?` + new URLSearchParams({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id,name,parents)',
    pageSize: '50',
  })
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const data = await res.json()
  return data.files ?? []
}

async function classifyBatch(files: any[], spaces: any[]): Promise<any[]> {
  const spaceNames = spaces.map(s => s.path).join(', ')
  const fileList = files.map(f => `${f.id} | ${f.name} | ${f.mimeType ?? 'unknown'}`).join('\n')

  const system = `You are a file classification AI for a GCC FM consultant and DBA researcher named Douglas Masuku.
His company structure: VeritasIQ Technologies Ltd (UAE FM consulting), Sustain International UK Ltd, VeritasIQ Technologies Ltd (SaaS — VeritasEdge™, InvestiScript, PIOS).
His projects: Qiddiya (QPMO-410), King Salman Park (KSP), VeritasEdge™, InvestiScript, PIOS, DBA research at University of Portsmouth.

Available filing spaces: ${spaceNames}

Classify each file. Return ONLY valid JSON array — one object per file in the same order:
[
  {
    "id": "drive-file-id",
    "ai_category": "invoice|contract|report|proposal|correspondence|technical|financial|legal|personal|academic|presentation|spreadsheet|image|other",
    "ai_project_tag": "project name or null",
    "ai_company_tag": "company entity name or null",
    "ai_summary": "One sentence describing what this file likely contains",
    "suggested_space": "exact path from available spaces or null",
    "confidence": 0.0-1.0,
    "is_likely_duplicate": false,
    "notes": "any classification notes"
  }
]`

  const raw = await callClaude(
    [{ role: 'user', content: `Classify these ${files.length} files:\n${fileList}` }],
    system, 3000
  )

  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    return files.map(f => ({ id: f.id, ai_category: 'other', confidence: 0.5, ai_summary: 'Classification pending' }))
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { folder_id = 'root', max_files = 50, apply_rules = true } = await request.json()

    const token = await getGoogleToken(supabase, user.id)
    if (!token) return NextResponse.json({ error: 'Google Drive not connected. Please reconnect Google in Settings.' }, { status: 400 })

    // Create scan session
    const { data: scan } = await supabase.from('drive_scans').insert({
      user_id: user.id,
      scan_path: folder_id,
      status: 'running',
    }).select('id').single()
    const scanId = scan?.id

    // List files from Drive
    const driveFiles = await listDriveFiles(token, folder_id, max_files)

    if (driveFiles.length === 0) {
      await supabase.from('drive_scans').update({ status: 'completed', completed_at: new Date().toISOString(), files_scanned: 0 }).eq('id', scanId)
      return NextResponse.json({ scanId, filesScanned: 0, items: [], message: 'No files found in this folder' })
    }

    // Get user's file spaces for classification context
    const { data: spaces } = await supabase.from('file_spaces').select('path, name, id').eq('user_id', user.id).order('sort_order')

    // Classify in batches of 20
    const BATCH = 20
    const classifications: any[] = []
    for (let i = 0; i < driveFiles.length; i += BATCH) {
      const batch = driveFiles.slice(i, i + BATCH)
      const classified = await classifyBatch(batch, spaces ?? [])
      classifications.push(...classified)
    }

    // Build a classification map
    const classMap = Object.fromEntries(classifications.map(c => [c.id, c]))

    // Get filing rules
    const { data: rules } = await supabase.from('filing_rules')
      .select('*').eq('user_id', user.id).eq('is_active', true).order('priority')

    let invoicesFound = 0

    // Upsert file_items
    const inserts = driveFiles.map(f => {
      const c = classMap[f.id] ?? {}

      // Find suggested space ID
      let spaceId: string | null = null
      if (c.suggested_space && spaces) {
        const match = spaces.find(s => s.path === c.suggested_space)
        if (match) spaceId = match.id
      }

      // Apply filing rules
      if (apply_rules && rules) {
        for (const rule of rules) {
          let matches = false
          const val = rule.trigger_value?.toLowerCase() ?? ''
          if (rule.trigger_type === 'file_name') {
            const n = f.name?.toLowerCase() ?? ''
            matches = rule.trigger_match === 'exact' ? n === val
              : rule.trigger_match === 'starts_with' ? n.startsWith(val)
              : rule.trigger_match === 'ends_with' ? n.endsWith(val)
              : n.includes(val)
          } else if (rule.trigger_type === 'file_type') {
            const ext = f.name?.split('.').pop()?.toLowerCase() ?? ''
            matches = ext === val
          } else if (rule.trigger_type === 'ai_category') {
            matches = c.ai_category === val
          }
          if (matches && rule.action_type === 'file_to_space' && spaces) {
            const match = spaces.find(s => s.path === rule.action_value)
            if (match) spaceId = match.id
          }
        }
      }

      if (c.ai_category === 'invoice') invoicesFound++

      const ext = f.name?.split('.').pop()?.toLowerCase()
      return {
        user_id: user.id,
        drive_file_id: f.id,
        name: f.name,
        file_type: ext ?? null,
        mime_type: f.mimeType ?? null,
        size_bytes: f.size ? parseInt(f.size) : null,
        source: 'drive',
        drive_web_url: f.webViewLink ?? null,
        space_id: spaceId,
        ai_category: c.ai_category ?? null,
        ai_project_tag: c.ai_project_tag ?? null,
        ai_company_tag: c.ai_company_tag ?? null,
        ai_summary: c.ai_summary ?? null,
        ai_confidence: c.confidence ?? null,
        filing_status: spaceId ? 'classified' : 'unprocessed',
        updated_at: new Date().toISOString(),
      }
    })

    // Upsert (avoid duplicate inserts for same Drive file)
    const { data: items } = await supabase.from('file_items')
      .upsert(inserts, { onConflict: 'drive_file_id', ignoreDuplicates: false })
      .select('id, name, ai_category, filing_status, drive_web_url, ai_summary, space_id')

    // Update scan record
    await supabase.from('drive_scans').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      files_scanned: driveFiles.length,
      files_classified: classifications.filter(c => c.ai_category && c.ai_category !== 'other').length,
      invoices_found: invoicesFound,
    }).eq('id', scanId)

    return NextResponse.json({
      scanId,
      filesScanned: driveFiles.length,
      filesClassified: classifications.filter(c => c.ai_category !== 'other').length,
      invoicesFound,
      items: items ?? [],
    })
  } catch (err: any) {
    console.error('/api/files/scan:', err)
    return NextResponse.json({ error: err.message ?? 'Scan failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // List Drive folders for folder picker
    if (action === 'folders') {
      const { data: profile } = await supabase.from('user_profiles')
        .select('google_access_token').eq('id', user.id).single()
      if (!profile?.google_access_token) return NextResponse.json({ folders: [] })
      const token = await getGoogleToken(supabase, user.id)
      if (!token) return NextResponse.json({ folders: [] })
      const folders = await listDriveFolders(token, searchParams.get('parent') ?? 'root')
      return NextResponse.json({ folders })
    }

    // Recent scans
    const { data } = await supabase.from('drive_scans')
      .select('*').eq('user_id', user.id)
      .order('started_at', { ascending: false }).limit(5)
    return NextResponse.json({ scans: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
