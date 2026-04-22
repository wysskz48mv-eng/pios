import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireOwnedEngagement } from '@/app/api/fm/_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

function keywords(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
    .slice(0, 8)
}

export async function POST(req: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { id } = await context.params
    const auth = await requireOwnedEngagement(req, id)
    if ('error' in auth) return auth.error

    const { admin, user } = auth

    const [{ data: risks }, { data: emails }] = await Promise.all([
      admin
        .from('engagement_risks')
        .select('id,custom_title,custom_description,risk_library:fm_risk_library(title,description)')
        .eq('engagement_id', id),
      admin
        .from('email_items')
        .select('id,subject,body_preview,received_at')
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .limit(250),
    ])

    const updates: Array<{ risk_id: string; linked_email_ids: string[]; linked_email_count: number }> = []

    for (const risk of risks ?? []) {
      const library = Array.isArray(risk.risk_library) ? risk.risk_library[0] : risk.risk_library
      const seed = `${risk.custom_title ?? ''} ${risk.custom_description ?? ''} ${library?.title ?? ''} ${library?.description ?? ''}`
      const terms = keywords(seed)
      if (!terms.length) continue

      const matched = (emails ?? [])
        .map((email) => {
          const hay = `${email.subject ?? ''} ${email.body_preview ?? ''}`.toLowerCase()
          const score = terms.reduce((acc, term) => acc + (hay.includes(term) ? 1 : 0), 0)
          return { id: email.id, score }
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((entry) => entry.id)

      await admin.from('engagement_risks').update({ linked_email_ids: matched }).eq('id', risk.id)

      updates.push({
        risk_id: risk.id,
        linked_email_ids: matched,
        linked_email_count: matched.length,
      })
    }

    return Response.json({ correlated: true, updates })
  } catch (err: unknown) {
    return apiError(err)
  }
}
