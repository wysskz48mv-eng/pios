/**
 * /api/files/upload — Upload files to Supabase Storage
 * Stores in user-scoped bucket, returns file metadata
 * PIOS Sprint 48 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export const runtime    = 'nodejs'
export const maxDuration = 30

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/json',
]

const MAX_SIZE_MB = 25

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: prof } = await (supabase as any)
      .from('user_profiles').select('tenant_id').eq('id', user.id).single()
    const tenantId = (prof as any)?.tenant_id
    if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const domain = String(formData.get('domain') ?? 'business')
    const tags = String(formData.get('tags') ?? '').split(',').map(t => t.trim()).filter(Boolean)

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({
        error: `File type not allowed: ${file.type}. Allowed: PDF, Word, Excel, images, CSV, JSON.`
      }, { status: 400 })
    }

    // Validate size
    const sizeMb = file.size / (1024 * 1024)
    if (sizeMb > MAX_SIZE_MB) {
      return NextResponse.json({ error: `File too large (${sizeMb.toFixed(1)} MB). Max: ${MAX_SIZE_MB} MB.` }, { status: 400 })
    }

    const ext      = file.name.split('.').pop() ?? 'bin'
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    const path     = `${user.id}/${Date.now()}_${safeName}`

    // Upload to Supabase Storage
    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validate magic bytes match declared MIME type
    const magicMismatch = checkMagicBytes(buffer, file.type)
    if (magicMismatch) {
      return NextResponse.json({ error: magicMismatch }, { status: 400 })
    }

    const { data: upload, error: uploadErr } = await (supabase as any)
      .storage.from('pios-files').upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadErr) throw uploadErr

    // Get public URL (or signed URL if bucket is private)
    const { data: urlData } = await (supabase as any)
      .storage.from('pios-files').createSignedUrl(path, 60 * 60 * 24 * 7) // 7 days

    const fileUrl = urlData?.signedUrl ?? null

    // Save metadata to files table
    const { data: fileRecord, error: dbErr } = await (supabase as any)
      .from('file_items').insert({
        user_id:      user.id,
        tenant_id:    tenantId,
        name:         file.name,
        file_type:    ext,
        mime_type:    file.type,
        size_kb:      Math.ceil(file.size / 1024),
        storage_path: path,
        url:          fileUrl,
        domain,
        tags,
        created_at:   new Date().toISOString(),
      }).select().single()

    if (dbErr) {
      // Clean up storage if DB insert fails
      await (supabase as any).storage.from('pios-files').remove([path])
      throw dbErr
    }

    return NextResponse.json({ file: fileRecord, url: fileUrl })
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── Magic byte validation ─────────────────────────────────────────────────
// Returns error string if mismatch, null if OK
function checkMagicBytes(buffer: Buffer, declaredType: string): string | null {
  if (buffer.length < 4) return 'File too small to validate'

  const SIGNATURES: Record<string, number[][]> = {
    'application/pdf':  [[0x25, 0x50, 0x44, 0x46]],           // %PDF
    'image/png':        [[0x89, 0x50, 0x4E, 0x47]],           // .PNG
    'image/jpeg':       [[0xFF, 0xD8, 0xFF]],                  // JFIF/EXIF
    'image/gif':        [[0x47, 0x49, 0x46, 0x38]],            // GIF8
    'image/webp':       [[0x52, 0x49, 0x46, 0x46]],            // RIFF
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                        [[0x50, 0x4B, 0x03, 0x04]],            // PK (ZIP)
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                        [[0x50, 0x4B, 0x03, 0x04]],            // PK (ZIP)
    'application/msword': [[0xD0, 0xCF, 0x11, 0xE0]],         // OLE2
    'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0]],   // OLE2
  }

  const expected = SIGNATURES[declaredType]
  if (!expected) return null // text/plain, text/csv, application/json — no magic bytes

  const matches = expected.some(sig =>
    sig.every((byte, i) => buffer[i] === byte)
  )

  if (!matches) {
    return 'File content does not match declared type. Upload rejected.'
  }

  return null
}
