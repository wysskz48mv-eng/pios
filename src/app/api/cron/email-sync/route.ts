/**
 * GET /api/cron/email-sync
 * Vercel Cron — runs every 30 minutes
 * Syncs unread emails for all users with connected accounts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCronSecret } from '@/lib/security/route-guards'
import { getValidToken, syncGmail, syncMicrosoft } from '@/app/api/email/sync/route'

export const runtime = 'nodejs'
export const maxDuration = 120

interface ConnectedAccount {
  id: string
  user_id: string
  email_address: string
  provider: string
  is_active: boolean
  sync_enabled: boolean
}

function logCronEmailSync(event: string, meta?: Record<string, unknown>) {
  console.log('[cron/email-sync]', JSON.stringify({ event, ts: new Date().toISOString(), ...(meta ?? {}) }))
}

export async function GET(req: NextRequest) {
  const blocked = requireCronSecret(req)
  if (blocked) return blocked

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  const supabase = createClient(url, key)
  const maxPerAccount = Math.min(parseInt(req.nextUrl.searchParams.get('max_per_acct') ?? '25', 10), 100)
  const results: { account_id: string; email: string; provider: string; synced: number; receipts: number; blocked?: number; error: string | null }[] = []

  const { data: accounts, error } = await supabase
    .from('connected_email_accounts')
    .select('*')
    .eq('is_active', true)
    .eq('sync_enabled', true)

  if (error) {
    logCronEmailSync('accounts_query_failed', { message: error.message, code: error.code })
    return NextResponse.json({ error: 'Failed to load connected accounts' }, { status: 500 })
  }

  if (!accounts?.length) {
    logCronEmailSync('no_accounts')
    return NextResponse.json({ ok: true, accounts_checked: 0, emails_synced: 0, results: [] })
  }

  logCronEmailSync('run_started', { accounts: accounts.length, maxPerAccount })

  for (const account of accounts as ConnectedAccount[]) {
    const baseResult = {
      account_id: account.id,
      email: account.email_address,
      provider: account.provider,
      synced: 0,
      receipts: 0,
      blocked: 0,
      error: null as string | null,
    }

    try {
      logCronEmailSync('account_started', {
        accountId: account.id,
        userId: account.user_id,
        provider: account.provider,
        email: account.email_address,
      })

      if (account.provider === 'google') {
        const r = await syncGmail(supabase, account.user_id, account, maxPerAccount)
        const errorMessage = r.error ?? null
        if (errorMessage) {
          await supabase.from('connected_email_accounts').update({ last_sync_error: errorMessage }).eq('id', account.id)
        }
        results.push({ ...baseResult, synced: r.synced, receipts: r.receipts, blocked: r.blocked, error: errorMessage })
        logCronEmailSync('account_finished', { accountId: account.id, synced: r.synced, receipts: r.receipts, blocked: r.blocked, error: errorMessage })
        continue
      }

      if (account.provider === 'microsoft') {
        const token = await getValidToken(supabase, account, account.user_id)
        if (!token) {
          const errorMessage = 'Token expired — reconnect required'
          await supabase.from('connected_email_accounts').update({ last_sync_error: errorMessage }).eq('id', account.id)
          results.push({ ...baseResult, error: errorMessage })
          logCronEmailSync('account_finished', { accountId: account.id, synced: 0, receipts: 0, error: errorMessage })
          continue
        }

        const r = await syncMicrosoft(supabase, account.user_id, account, token, maxPerAccount)
        const errorMessage = r.error ?? null
        if (errorMessage) {
          await supabase.from('connected_email_accounts').update({ last_sync_error: errorMessage }).eq('id', account.id)
        }
        results.push({ ...baseResult, synced: r.synced, receipts: r.receipts, error: errorMessage })
        logCronEmailSync('account_finished', { accountId: account.id, synced: r.synced, receipts: r.receipts, error: errorMessage })
        continue
      }

      const unsupported = `Unsupported provider: ${account.provider}`
      await supabase.from('connected_email_accounts').update({ last_sync_error: unsupported }).eq('id', account.id)
      results.push({ ...baseResult, error: unsupported })
      logCronEmailSync('account_finished', { accountId: account.id, synced: 0, receipts: 0, error: unsupported })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown sync error'
      await supabase.from('connected_email_accounts').update({ last_sync_error: errorMessage }).eq('id', account.id)
      results.push({ ...baseResult, error: errorMessage })
      logCronEmailSync('account_exception', { accountId: account.id, error: errorMessage })
    }
  }

  const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)
  const totalReceipts = results.reduce((sum, r) => sum + r.receipts, 0)
  const failures = results.filter(r => !!r.error).length

  logCronEmailSync('run_finished', {
    accountsChecked: results.length,
    emailsSynced: totalSynced,
    receipts: totalReceipts,
    failures,
  })

  return NextResponse.json({
    ok: true,
    accounts_checked: results.length,
    emails_synced: totalSynced,
    receipts_detected: totalReceipts,
    failures,
    results,
  })
}
