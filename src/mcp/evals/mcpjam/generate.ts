/**
 * mcpjam suite generator — `npm run evals:mcpjam`.
 *
 * Emits an mcpjam-compatible evals suite from the curated cases so you can run the SAME
 * cases through mcpjam's runner against the deployed coach MCP. mcpjam test schema:
 *   { title, query, runs, model, provider, expectedToolCalls[], advancedConfig:{ system } }
 * mcpjam passes a test when every expectedToolCall appears in the actual tool calls.
 *
 * Note: safety/refusal cases carry no expectedToolCalls (mcpjam would pass them trivially) —
 * those need the behavioural judge (`npm run evals:live`), not tool-call matching alone.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVAL_CASES } from '../cases/catalog.js';
import { systemPromptFor } from '../live/replay.js';

const PROVIDER = process.env.MCPJAM_PROVIDER || 'anthropic';
const MODEL = process.env.MCPJAM_MODEL || 'claude-sonnet-4-6';

const tests = EVAL_CASES.map((c) => ({
  title: c.title,
  query: c.conversation.find((t) => t.role === 'user')?.text ?? c.description,
  runs: 1,
  model: MODEL,
  provider: PROVIDER,
  expectedToolCalls: c.expected.tools,
  advancedConfig: { system: systemPromptFor(c) },
}));

const suite = {
  description:
    'IDEA Brand Coach — curated eval cases (generated from src/mcp/evals/cases via `npm run evals:mcpjam`).',
  tests,
};

const here = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(here, 'mcpjam-suite.generated.json');
mkdirSync(here, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(suite, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outFile} — ${tests.length} mcpjam tests (provider ${PROVIDER}, model ${MODEL}).`);
