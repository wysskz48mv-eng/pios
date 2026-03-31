/**
 * POST /api/cv-test — Debug CV upload
 * Returns what the server receives
 */
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const entries: Record<string, string> = {}
    
    formData.forEach((value, key) => {
      if (value instanceof File) {
        entries[key] = `File: ${value.name} (${value.size} bytes, ${value.type})`
      } else {
        entries[key] = String(value)
      }
    })
    
    const cvFile = formData.get('cv')
    const fileField = formData.get('file')
    
    return NextResponse.json({
      received_keys: Array.from(formData.keys()),
      entries,
      cv_field: cvFile ? (cvFile instanceof File ? `File: ${cvFile.name}` : 'not a file') : 'missing',
      file_field: fileField ? (fileField instanceof File ? `File: ${fileField.name}` : 'not a file') : 'missing',
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
