/**
 * MCPJam image-E2E suite generator — `npm run evals:image:mcpjam`.
 *
 * Emits an MCPJam suite that drives a REAL chat through BOTH connectors in one session —
 * our IDEA Brand Coach MCP (the plan directors) AND the Higgsfield MCP (generate_image) —
 * so the session actually PRODUCES an image, not just a plan. MCPJam passes a test when
 * every `expectedToolCalls` entry appears in the actual calls; each case's list ends with
 * the Higgsfield `generate_image` tool, so a pass PROVES the E2E pipeline ran end to end.
 *
 * Tool-call matching alone does NOT judge image quality — that is the vision-judge tier
 * (`npm run evals:image`), which scores the produced image URLs against the rubric. This
 * generator wires the run; the runner scores the deliverables.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMAGE_EVAL_CASES, HIGGSFIELD_IMAGE_TOOL } from './cases.js';
import { getCorpus } from './corpus.js';

const PROVIDER = process.env.MCPJAM_PROVIDER || 'anthropic';
const MODEL = process.env.MCPJAM_MODEL || 'claude-sonnet-4-6';

/** The session system prompt: coach posture + corpus context + the explicit E2E instruction. */
export function imageSessionSystem(caseId: string): string {
  const c = IMAGE_EVAL_CASES.find((x) => x.id === caseId);
  if (!c) throw new Error(`Unknown image case ${caseId}`);
  const corpus = getCorpus(c.corpusRef);
  if (!corpus) throw new Error(`Unknown corpus ${c.corpusRef}`);
  return [
    'You are operating a live working session for an Amazon seller with TWO MCP connectors attached: IDEA Brand Coach (planning) and Higgsfield (image generation).',
    'Produce the requested image deliverable END TO END: use the IDEA Brand Coach plan director to compose the brief + the exact IMAGE_PROMPT, then call the Higgsfield generate_image tool to actually render it (upload/reference the real product photo as the strict reference).',
    'Honour the claim gate: only facts the seller has confirmed may appear on the image; never render a fabricated claim, star rating, or badge, even if asked.',
    '',
    `Brand: ${corpus.brand} — ${corpus.product} (${corpus.asin}, ${corpus.price}).`,
    `Core problem: ${corpus.coreProblem}`,
    `Resolved positioning — weakest pillar: ${corpus.positioning.trustGapPillar}; Decision Trigger: ${corpus.positioning.decisionTrigger} (${corpus.positioning.anchor}).`,
    `Verified facts (allowed on the image): ${corpus.verifiedFacts.join('; ')}.`,
    `Prohibited/fabricated claims (never render): ${corpus.prohibitedClaims.join('; ')}.`,
  ].join('\n');
}

export interface McpjamImageTest {
  title: string;
  query: string;
  runs: number;
  model: string;
  provider: string;
  expectedToolCalls: string[];
  advancedConfig: { system: string };
  /** Extra metadata the vision-judge runner reads back (not part of MCPJam's schema). */
  meta: { caseId: string; deliverable: string; corpusRef: string; imageTool: string };
}

export function buildImageSuite(): { description: string; note: string; tests: McpjamImageTest[] } {
  const tests = IMAGE_EVAL_CASES.map((c) => ({
    title: c.title,
    query: c.query,
    runs: 1,
    model: MODEL,
    provider: PROVIDER,
    expectedToolCalls: c.expectedToolCalls,
    advancedConfig: { system: imageSessionSystem(c.id) },
    meta: { caseId: c.id, deliverable: c.deliverable, corpusRef: c.corpusRef, imageTool: HIGGSFIELD_IMAGE_TOOL },
  }));
  return {
    description:
      'IDEA Brand Coach — IMAGE output-quality E2E suite (our MCP + Higgsfield in one session). Tool-call pass proves the pipeline produced an image; run `npm run evals:image` to score the produced images against the rubric.',
    note: 'Each test needs BOTH connectors attached in MCPJam (IDEA Brand Coach + Higgsfield) and a provider key. The last expectedToolCall is the Higgsfield image tool — a pass means an image was actually rendered.',
    tests,
  };
}

/** CLI entry: write the suite JSON next to the behavioural mcpjam suite. */
export function writeImageSuite(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const outFile = resolve(here, '../mcpjam/mcpjam-image-suite.generated.json');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(buildImageSuite(), null, 2)}\n`, 'utf8');
  return outFile;
}

// Executed only when run directly (tsx), not on import (keeps tests side-effect free).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const out = writeImageSuite();
  const n = IMAGE_EVAL_CASES.length;
  console.log(`Wrote ${out} — ${n} image E2E tests (provider ${PROVIDER}, model ${MODEL}). Attach BOTH connectors in MCPJam.`);
}
