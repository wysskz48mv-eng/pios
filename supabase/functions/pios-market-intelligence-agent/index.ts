// pios-market-intelligence-agent
// File: supabase/functions/pios-market-intelligence-agent/index.ts
//
// Reads intelligence_agent_config (market_intelligence type) per user,
// uses Claude + web_search to gather and score relevant market items,
// writes results to market_intelligence + insights tables,
// logs every run to intelligence_agent_run_log.
//
// Deployed: 2026-04-08  ID: 6f009691-239d-43be-82dd-f26ba9ae5409
// Schedule: daily 05:00 UTC via Vercel cron → /api/cron/market-intelligence
//
// Required Supabase secrets:
//   ANTHROPIC_API_KEY
//   SUPABASE_SERVICE_ROLE_KEY
//   CRON_SECRET

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_KEY  = Deno.env.get('ANTHROPIC_API_KEY')!;
const CRON_SECRET    = Deno.env.get('CRON_SECRET');

// ...full file content from your attachment here...
