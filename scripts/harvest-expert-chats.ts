/**
 * scripts/harvest-expert-chats.ts — Expert Intelligence Loop, Feeder 2 runner (nightly).
 *
 * Sweeps designated experts' in-app chat for redirect turns and writes them into expert_corrections
 * as source='chat'. Runs OFF the MCP gateway (a scheduled cloud agent or cron), so it uses a
 * SERVICE-ROLE client — it reads across experts and inserts on their behalf (RLS can't do that).
 *
 * Env: SUPABASE_URL (or VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY. Optional EXPERT_EMAILS.
 * Usage: SUPABASE_SERVICE_ROLE_KEY=… tsx scripts/harvest-expert-chats.ts [--since <ISO>]
 *
 * Idempotent via the high-water mark: pass --since <last run's highWater>; defaults to the last 24h.
 * The new highWater is logged for the scheduler to persist for the next run.
 */
import { createClient } from '@supabase/supabase-js';
import { buildHarvestDeps, harvestExpertChats } from '../src/mcp/service/expertHarvest.js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service-role required — reads across experts).');
  process.exit(1);
}

const sinceIdx = process.argv.indexOf('--since');
const sinceIso =
  sinceIdx > -1 && process.argv[sinceIdx + 1]
    ? process.argv[sinceIdx + 1]
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const summary = await harvestExpertChats(buildHarvestDeps(client), { sinceIso });
console.log(JSON.stringify({ event: 'expert_harvest.done', sinceIso, ...summary }, null, 2));
