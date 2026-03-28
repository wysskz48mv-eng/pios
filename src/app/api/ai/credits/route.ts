import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/ai/credits
 * Returns NemoClaw™ AI credit usage for the current user.
 * Used by PlatformShell topbar credit meter.
 * 
 * Reads from exec_intelligence_config (set by M023).
 * Falls back to 100 limit / 0 used if table doesn't exist.
 * VeritasIQ Technologies Ltd
 */

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ used: 0, limit: 100 })

    // Try exec_intelligence_config first (M023)
    const { data: config } = await supabase
      .from('exec_intelligence_config')
      .select('ai_calls_used, ai_calls_limit, reset_date')
      .eq('user_id', user.id)
      .single()

    if (config) {
      // Reset counter if past reset date
      const resetDate = config.reset_date ? new Date(config.reset_date) : null
      const isReset   = resetDate && resetDate < new Date()

      if (isReset) {
        await supabase
          .from('exec_intelligence_config')
          .update({
            ai_calls_used: 0,
            reset_date:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('user_id', user.id)

        return NextResponse.json({ used: 0, limit: config.ai_calls_limit ?? 100, reset: true })
      }

      return NextResponse.json({
        used:  config.ai_calls_used  ?? 0,
        limit: config.ai_calls_limit ?? 100,
      })
    }

    // Fallback: count ai_usage_log entries this month
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('ai_credits_resets')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString())

    return NextResponse.json({ used: count ?? 0, limit: 100 })
  } catch {
    return NextResponse.json({ used: 0, limit: 100 })
  }
}
