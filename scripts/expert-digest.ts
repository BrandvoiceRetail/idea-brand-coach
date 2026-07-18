/**
 * scripts/expert-digest.ts — Expert Intelligence Loop, weekly digest runner.
 *
 * Summarizes the corrections that became LIVE coaching updates this week and posts it to the team
 * Slack channel (where Trevor reads it), via the same FeedbackNotifier submit_feedback uses. Runs
 * AFTER the human publish step, weekly. Reports only APPLIED changes; skips an empty week.
 *
 * Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read published instructions + applied counts),
 * SLACK_BOT_TOKEN + SLACK_FEEDBACK_CHANNEL_ID (delivery; degrades to {sent:false} if unset).
 * Usage: … tsx scripts/expert-digest.ts [--days <n>]   (default 7)
 */
import { createClient } from '@supabase/supabase-js';
import { buildDigestDeps, sendWeeklyDigest } from '../src/mcp/service/expertDigest.js';
import { FeedbackNotifier } from '../src/mcp/slack/feedbackNotifier.js';
import { loadConfig } from '../src/mcp/config.js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const daysIdx = process.argv.indexOf('--days');
const days = daysIdx > -1 && process.argv[daysIdx + 1] ? Number(process.argv[daysIdx + 1]) : 7;
const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const notifier = new FeedbackNotifier(loadConfig());
const res = await sendWeeklyDigest(buildDigestDeps(client, notifier), { sinceIso, sinceLabel: `in the last ${days} days` });
console.log(JSON.stringify({ event: 'expert_digest.done', sinceIso, ...res }, null, 2));
