/**
 * Brand-Coach MCP — conversation corpus replay harness.
 *
 * The corpus is a set of golden transcript fixtures (one per traceability-matrix row) that
 * record a user (one of two ICPs) interacting with the MCP in ways that uniquely use our §1a
 * tools, powered by the IDEA skills, powered by the book.
 *
 * Tiers (see test-design doc):
 *   Tier-0 (runs now)  — fixture INTEGRITY: every fixture is well-formed, declares the tools it
 *                        exercises, tags them inline, and carries an artifact + machine-checkable
 *                        assertions. This validates the recorded corpus without the MCP host.
 *   Tier-1 (gated)     — LIVE replay through the MCP gateway (feat/brand-coach-mcp-host). Skipped
 *                        until the host is importable here; each fixture's Assertions block becomes
 *                        the executable oracle.
 *   Calc-parity (gated)— each wrapped-engine tool == direct engine output (Calculation Parity).
 */
import { describe, it, expect } from 'vitest';
import { loadFixtures, NON_CONVERSATIONAL_TOOLS, type Fixture } from '../fixtures/conversations/loader';

const fixtures = loadFixtures();

// Gate Tier-1 on the presence of the MCP host (env flag flips when feat/brand-coach-mcp-host is wired in).
const HOST_AVAILABLE = process.env.BRAND_COACH_MCP_HOST === '1';

describe('MCP conversation corpus — Tier-0 fixture integrity (runs now)', () => {
  it('corpus is recorded and non-empty', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it('every fixture has a unique tc_id', () => {
    const ids = fixtures.map((f) => f.tc_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(fixtures.map((f) => [f.tc_id, f] as [string, Fixture]))('%s', (_id, f) => {
    it('has complete front-matter (tc_id, persona, ≥1 tool, type, priority, status)', () => {
      expect(f.tc_id).toBeTruthy();
      expect(f.persona, `${f.relFile}: persona`).toBeTruthy();
      expect(f.tools.length, `${f.relFile}: tools`).toBeGreaterThan(0);
      expect(f.type, `${f.relFile}: type`).toBeTruthy();
      expect(f.priority, `${f.relFile}: priority`).toBeTruthy();
      expect(f.status, `${f.relFile}: status`).toBe('recorded');
    });

    it('declares conversational tools that appear as inline ⟦tool:⟧ provenance tags', () => {
      const expected = f.tools.filter((t) => !NON_CONVERSATIONAL_TOOLS.has(t));
      for (const tool of expected) {
        expect(
          f.toolTags.some((t) => t.includes(tool)),
          `${f.relFile}: tool "${tool}" declared in front-matter but not tagged in transcript`,
        ).toBe(true);
      }
    });

    it('grounds the coach in cited skills (≥1 ⟦skill:⟧ tag) unless it is a user-KB/infra-only case', () => {
      const userKbOnly = f.tools.every((t) => t === 'search_user_kb' || NON_CONVERSATIONAL_TOOLS.has(t));
      if (!userKbOnly) {
        expect(f.skillTags.length, `${f.relFile}: no ⟦skill:⟧ provenance tags`).toBeGreaterThan(0);
      }
    });

    it('produces an artifact and a machine-checkable assertions block', () => {
      expect(f.body, `${f.relFile}: missing "### Artifact produced"`).toMatch(/###\s+Artifact produced/);
      expect(f.assertions.length, `${f.relFile}: no "- [oracle]" assertions`).toBeGreaterThan(0);
    });

    it('carries the persona-adaptation oracle for its persona', () => {
      expect(
        f.assertions.some((a) => a.includes(`persona-adapt:${f.persona}`)),
        `${f.relFile}: missing [persona-adapt:${f.persona}] assertion`,
      ).toBe(true);
    });
  });
});

describe('Coverage invariants (Tier-0)', () => {
  it('exercises both ICPs (P1 Busy Owner + P2 Operations VA)', () => {
    const personas = new Set(fixtures.map((f) => f.persona));
    expect(personas.has('P1')).toBe(true);
    expect(personas.has('P2')).toBe(true);
  });

  it('the owned critical-path chain tools each appear in ≥1 recorded conversation', () => {
    const chain = ['generate_concepts', 'publish_filter_check', 'draft_asset', 'design_test'];
    for (const tool of chain) {
      expect(
        fixtures.some((f) => f.tools.includes(tool)),
        `no recorded conversation exercises chain tool "${tool}"`,
      ).toBe(true);
    }
  });

  it('includes isolation/negative cases (L4)', () => {
    expect(fixtures.some((f) => f.type === 'isolation')).toBe(true);
    expect(fixtures.some((f) => f.type === 'negative')).toBe(true);
  });

  it('includes uniqueness cases (L5)', () => {
    expect(fixtures.some((f) => f.type === 'uniqueness')).toBe(true);
  });
});

// ─── Tier-1: live replay through the MCP gateway (gated on feat/brand-coach-mcp-host) ───
(HOST_AVAILABLE ? describe : describe.skip)(
  'MCP live replay (Tier-1 — gated on BRAND_COACH_MCP_HOST=1 / feat/brand-coach-mcp-host)',
  () => {
    it.todo('replay each fixture through the gateway; assert [tool-call], [schema], [persona-adapt], [safety]');
    it.todo('per-request RLS isolation: concurrent owners do not leak identity (TC-INFRA-GW-1)');
    it.todo('MF-1: search_user_kb refuses cross-tenant unless owner/va_grants (TC-L1-search_user_kb, TC-E4)');
    it.todo('confused-deputy: build_avatar ignores MCP-supplied field_source (TC-L1-build_avatar)');
  },
);

// ─── Calculation-parity: each wrapped-engine tool == direct engine output ───
describe('Calculation parity (gated — wire when engines are importable / host lands)', () => {
  it.todo('TC-CP-1 run_trust_gap == src/lib/trustGap.ts:buildTrustGap()');
  it.todo('TC-CP-2 run_diagnostic == SupabaseDiagnosticService.calculateScores()');
  it.todo('TC-CP-3 build_avatar == FieldPersistenceService persist + lock');
  it.todo('TC-CP-4 draft_asset == brand-copy-generator');
  it.todo('TC-CP-5 export_strategy_doc == generate-brand-strategy-section (+ RAG retrieval-overlap)');
  it.todo('TC-CP-6 generate_signature == reveal-signature (incl. empty-input decline)');
  it.todo('TC-CP-7 run_conversation == buffered callConsultant stream');
});
