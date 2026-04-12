import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

type Payload = {
  user_id?: string
  cv_storage_path?: string
  cv_filename?: string | null
  persona_code?: string | null
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as Payload
    const userId = typeof body.user_id === 'string' ? body.user_id : ''
    const cvPath = typeof body.cv_storage_path === 'string' ? body.cv_storage_path : ''

    if (!userId || !cvPath) {
      return new Response(JSON.stringify({ error: 'user_id and cv_storage_path are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const now = new Date().toISOString()

    await supabase
      .from('user_profiles')
      .update({ cv_processing_status: 'processing', updated_at: now })
      .eq('id', userId)

    await supabase
      .from('nemoclaw_calibration')
      .upsert(
        {
          user_id: userId,
          status: 'processing',
          cv_storage_path: cvPath,
          cv_filename: body.cv_filename ?? null,
          extracted_data: {
            source: 'cv-ingestion-pipeline',
            persona_code: body.persona_code ?? null,
            message: 'CV queued for calibration',
          },
          updated_at: now,
        },
        { onConflict: 'user_id' },
      )

    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('pios-cv')
      .download(cvPath)

    if (downloadErr) {
      await supabase
        .from('nemoclaw_calibration')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('user_id', userId)

      await supabase
        .from('user_profiles')
        .update({ cv_processing_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', userId)

      return new Response(JSON.stringify({ error: downloadErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const fileSize = fileData?.size ?? 0
    const doneAt = new Date().toISOString()

    await supabase
      .from('nemoclaw_calibration')
      .upsert(
        {
          user_id: userId,
          status: 'completed',
          cv_storage_path: cvPath,
          cv_filename: body.cv_filename ?? null,
          extracted_data: {
            source: 'cv-ingestion-pipeline',
            persona_code: body.persona_code ?? null,
            file_size_bytes: fileSize,
            message: 'CV ingestion completed (lightweight parser path)',
          },
          processed_at: doneAt,
          updated_at: doneAt,
        },
        { onConflict: 'user_id' },
      )

    await supabase
      .from('user_profiles')
      .update({
        cv_processing_status: 'complete',
        nemoclaw_calibrated: true,
        nemoclaw_calibrated_at: doneAt,
        updated_at: doneAt,
      })
      .eq('id', userId)

    return new Response(JSON.stringify({ ok: true, user_id: userId, cv_storage_path: cvPath }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})
