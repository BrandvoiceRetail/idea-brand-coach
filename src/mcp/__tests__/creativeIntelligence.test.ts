/**
 * Creative Intelligence layer — conformance test (IDEA D / Distinctive).
 *
 * Trevor (2026-06): the coach was "very literal" — it parroted the customer's
 * own words instead of making the creative leap into ownable marketing
 * expression ("nobody says BATTLE READY; that is marketing, it belongs in the D
 * pillar"). This test pins the discipline across the three surfaces that govern
 * it so a future edit cannot silently regress the coach back to literalness:
 *   1. the MCP connector posture (SERVER_INSTRUCTIONS),
 *   2. the concept-generation engine prompt (buildConceptPrompt),
 *   3. the in-app / consultant system prompt (prompt.ts creative block).
 *
 * The non-negotiable invariant: the FACT plane stays gated (never invent data),
 * while the EXPRESSION plane is licensed AND disciplined (offer as a hypothesis
 * to TEST, never as a fact).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { SERVER_INSTRUCTIONS } from '../config.js';
import { buildConceptPrompt } from '../service/concepts.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('Creative Intelligence — MCP connector posture (SERVER_INSTRUCTIONS)', () => {
  it('carves EXPRESSION out of the blanket no-invention rule', () => {
    expect(SERVER_INSTRUCTIONS).toContain('CREATIVE INTELLIGENCE');
    // Facts stay gated; expression is licensed.
    expect(SERVER_INSTRUCTIONS).toMatch(/FACTS/);
    expect(SERVER_INSTRUCTIONS).toMatch(/EXPRESSION/);
    expect(SERVER_INSTRUCTIONS).toContain('battle ready');
    expect(SERVER_INSTRUCTIONS).toContain('Distinctive');
  });

  it('keeps creative output a hypothesis routed to a resonance test', () => {
    expect(SERVER_INSTRUCTIONS).toContain('design_test');
    expect(SERVER_INSTRUCTIONS).toMatch(/never as a fact or finished claim/i);
  });
});

describe('Creative Intelligence — concept engine (buildConceptPrompt)', () => {
  const p = buildConceptPrompt({ brief: 'protect my collection from damage', channel: 'instagram', count: 3 });

  it('demands the literal -> distinctive leap, not a restatement', () => {
    expect(p).toContain('CREATIVE LEAP');
    expect(p).toContain('battle ready');
    expect(p).toMatch(/OWNABLE/);
    expect(p).toMatch(/SURPRISING/);
    expect(p).toMatch(/TESTABLE/);
    expect(p).toMatch(/do not hand the brief's own words back/i);
  });

  it('preserves the stable JSON contract (parser + consumers depend on it)', () => {
    expect(p).toContain('exactly 3');
    expect(p).toContain('protect my collection from damage');
    expect(p).toContain('JSON array');
    expect(p).toContain('{"title": string, "hook": string, "angle": string, "rationale": string}');
  });
});

describe('Creative Intelligence — consultant system prompt (prompt.ts)', () => {
  // prompt.ts is a Deno edge-fn module; assert on its source so we do not pull a
  // Deno runtime import into the Node/vitest project.
  const promptSrc = readFileSync(
    resolve(here, '../../../supabase/functions/idea-framework-consultant-claude/prompt.ts'),
    'utf8',
  );

  it('ships the <creative-intelligence> block', () => {
    expect(promptSrc).toContain('<creative-intelligence>');
    expect(promptSrc).toContain('buildCreativeIntelligenceInstructions');
  });

  it('draws the FACTS / EXPRESSION firewall and teaches the leap', () => {
    expect(promptSrc).toMatch(/FACTS —/);
    expect(promptSrc).toMatch(/EXPRESSION —/);
    expect(promptSrc).toContain('BATTLE READY');
    expect(promptSrc).toMatch(/OWNABLE .*SURPRISING .*TRUE .*TESTABLE/s);
  });

  it('always offers expression as a creative angle to TEST, not a fact', () => {
    expect(promptSrc).toMatch(/CREATIVE ANGLE TO TEST/);
    expect(promptSrc).toMatch(/resonance test/);
  });

  it('is wired into the always-on static system block (both modes)', () => {
    expect(promptSrc).toMatch(/prompt \+= '\\n' \+ buildCreativeIntelligenceInstructions\(\)/);
  });
});
