/**
 * Conversation-harvest sweep (CLI) — `npm run evals:harvest [dir]`.
 *
 * Weekly loop: ingest logged conversations → classify by ICP → propose candidate eval cases →
 * screen (pass/fail) → failing ones become feature ideas → aggregate ICP signal. Writes the
 * candidate cases + feature ideas to src/mcp/evals/harvest/out/ for review before promotion.
 *
 * SOURCE: pass a directory of conversation JSON files (each an array or a single Conversation);
 * with no dir it uses the bundled sample. The real source is Supabase chat_sessions / MCP
 * transcripts — wire that adapter where noted (see docs/evals/CONVERSATION_HARVEST_LOOP.md).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { harvestSweep } from './harvest/harvest.js';
import { SAMPLE_CONVERSATIONS } from './harvest/sampleConversations.js';
import type { Conversation } from './harvest/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const line = '─'.repeat(64);

function loadFromDir(dir: string): Conversation[] {
  const out: Conversation[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const parsed = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (Array.isArray(parsed)) out.push(...parsed);
    else out.push(parsed);
  }
  return out;
}

const dirArg = process.argv[2];
let conversations: Conversation[];
let sourceLabel: string;
if (dirArg && existsSync(dirArg)) {
  conversations = loadFromDir(dirArg);
  sourceLabel = `${conversations.length} conversation(s) from ${dirArg}`;
} else {
  conversations = SAMPLE_CONVERSATIONS;
  sourceLabel = `${conversations.length} bundled sample conversation(s) (pass a dir of JSON, or wire the Supabase adapter)`;
}

const sweep = harvestSweep(conversations);
const outDir = resolve(here, 'harvest/out');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'candidates.json'), `${JSON.stringify(sweep.candidates, null, 2)}\n`);
writeFileSync(join(outDir, 'feature-ideas.json'), `${JSON.stringify(sweep.featureIdeas, null, 2)}\n`);
writeFileSync(join(outDir, 'icp-signals.json'), `${JSON.stringify(sweep.icpSignals, null, 2)}\n`);

console.log(line);
console.log('IDEA Brand Coach — Conversation Harvest Sweep');
console.log(line);
console.log(`Source: ${sourceLabel}`);
console.log(`Candidates: ${sweep.total} · passing: ${sweep.passing} · failing: ${sweep.failing}`);
console.log('\nCandidate cases (status: candidate — review before promoting to the catalog):');
for (const c of sweep.candidates) {
  console.log(`  [${c.screen.passed ? 'PASS' : 'FAIL'}] ${c.persona}  ${c.title}`);
  if (!c.screen.passed) for (const r of c.screen.reasons) console.log(`         ↳ ${r}`);
}
if (sweep.featureIdeas.length) {
  console.log('\nFeature ideas (from failing conversations — real customer asks we can’t yet serve):');
  for (const fi of sweep.featureIdeas) console.log(`  • ${fi.suggestedCapability}\n      ask: "${fi.userAsk}"`);
}
console.log('\nICP signal (feeds growth of src/mcp/evals/icp/profiles.ts):');
for (const s of sweep.icpSignals) {
  console.log(`  ${s.icpId}: ${s.conversations} conv · ${s.vocabulary.length} vocab · ${s.problems.length} problems`);
}
console.log(`\nWrote candidates / feature-ideas / icp-signals to ${outDir}`);
console.log(line);
