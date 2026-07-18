/**
 * scripts/expert-distill.ts — Expert Intelligence Loop, distill runner (nightly).
 *
 * Reads status='new' expert_corrections, clusters them by topic, and drafts one coach_instruction
 * per cluster (status='draft', provenance-linked). NEVER publishes — a human reviews + publishes in
 * the Studio, weekly. Deterministic body composition today; a nightly agent can supersede it with
 * LLM-authored prose later. Runs OFF the gateway (scheduled agent / cron) with a SERVICE-ROLE client.
 *
 * Env: SUPABASE_URL (or VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 * Usage: SUPABASE_SERVICE_ROLE_KEY=… tsx scripts/expert-distill.ts
 */
import { createClient } from '@supabase/supabase-js';
import { buildDistillDeps, runDistill } from '../src/mcp/service/expertDistill.js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service-role required — reads/writes across the table).');
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const summary = await runDistill(buildDistillDeps(client));
console.log(JSON.stringify({ event: 'expert_distill.done', ...summary }, null, 2));
