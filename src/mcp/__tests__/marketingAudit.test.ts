// @vitest-environment node
/**
 * Phase 5 Agent B — marketing-audit calibration + tool test.
 *
 * Load-bearing assertions (per the goal prompt):
 *  1. Seeded IV gold-era facts (revenue $10K, margin 10%, ad spend $618→$450, ACOS 14/12,
 *     June repayment ~$1K/mo, May inventory order, email list 0, LTSF risk on the 288
 *     singles, brand registry yes) reproduce the gold-B tiering + phasing.
 *  2. With missing revenue every gap surfaces as needs_input — NOTHING is silently invented.
 *  3. The marketing-audit edge fn enriches PROSE only: numbers-in == numbers-out (the fn
 *     cannot return a number, and the tool never reads one from it).
 *  4. The tool is identity-gated (anon denied) and persists to marketing_audits + the
 *     marketing_audit / rollout_plan artifacts for an authenticated caller.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import workbookB from './fixtures/workbook-b.json';
import {
  parseBusinessFacts,
  calibrate,
  tierFor,
  buildInvestmentRows,
  CALIBRATION_BASELINE_REVENUE,
  type CalibrationFacts,
  type ResolvedFactSlot,
} from '../service/auditCalibration.js';
import { MARKETING_MOVE_LIBRARY, getMarketingMove } from '../data/marketingMoves.js';
import {
  runMarketingAudit,
  registerRunMarketingAuditTool,
  type RunMarketingAuditDeps,
  type MarketingAuditRow,
} from '../tools/runMarketingAudit.js';
import { EdgeFnClient, type EdgeFnResult } from '../edgeFn/client.js';
import type { ArtifactRow, SaveArtifactOptions } from '../service/artifactStore.js';
import type { ResolvedSlot } from '../service/contextResolver.js';
import type { ArtifactKind, MarketingAuditOutput, RolloutPlanOutput } from '../contracts/index.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

// --- Gold fixture access -------------------------------------------------------------
type Cell = string | number | null;
interface FixtureTable { name: string | null; note: string | null; columns: (string | null)[]; rows: Cell[][] }
interface FixtureSheet { sheet: string; title: string; header_note: string | null; tables: FixtureTable[] }
const wbB = workbookB as { workbook: string; sheets: FixtureSheet[] };
const goldMatrix = wbB.sheets[0].tables.find((t) => t.columns.includes('Investment'))!;
const goldRows = goldMatrix.rows;

// --- Seeded IV gold-era BUSINESS-FACTs ------------------------------------------------

/**
 * The IV facts that powered the gold workbook. Brand registry + storefront present (the
 * gold has A+ and a Storefront-cleanup move in T1), TCG niche, running PPC, off-Amazon
 * growth intent (gold has T3 off-Amazon moves), LTSF risk on the 288 singles, tight cash.
 */
function ivFactSlots(over: Partial<Record<number, unknown>> = {}): ResolvedFactSlot[] {
  const base: Record<number, unknown> = {
    8: { monthlyRevenue: 10000, marginTarget: 0.1, adSpend: 618, adSpendTarget: 450 },
    7: { brandRegistry: true, storefront: true, aplusContent: false, professionalPhotography: false, productVideo: false, provenAdStructure: false, corePpcAtTarget: false },
    10: { hasListings: true, tcgOrHobbyNiche: true, wantsOffAmazonGrowth: true, hasExternalTraffic: true, emailList: false },
    11: { ltsfRisk: true },
    9: { inventoryOrderNote: 'May inventory order priority', repaymentNote: '~$1K/mo Uncapped repayment starting June', tightCash: true },
    16: { competitors: ['Ultra Pro', 'Vault X'] },
    5: [{ name: '216 Diamond Grain' }, { name: '288 single' }, { name: '288 2-pack' }],
    ...over,
  };
  return Object.entries(base).map(([slot, value]) => ({
    slot: Number(slot),
    value,
    status: value == null ? 'missing' : 'filled-stated',
  }));
}

function ivFacts(): CalibrationFacts {
  const r = parseBusinessFacts(ivFactSlots());
  if (!r.ok) throw new Error('IV facts should parse');
  return r.facts;
}

// --- Stubs ----------------------------------------------------------------------------

function stubEdgeFn(reply: Record<string, unknown> | { fail: true } | null): EdgeFnClient {
  return {
    invoke: async <T>(): Promise<EdgeFnResult<T>> => {
      if (reply === null) return { ok: false, data: null, note: 'unavailable' };
      if ((reply as { fail?: true }).fail) return { ok: false, data: null, note: 'unavailable' };
      return { ok: true, data: reply as T };
    },
  } as unknown as EdgeFnClient;
}

function makeResolve(slots: ResolvedFactSlot[]): RunMarketingAuditDeps['resolve'] {
  const map = new Map(slots.map((s) => [s.slot, s]));
  return (async (ids: number[]): Promise<ResolvedSlot[]> =>
    ids.map((id): ResolvedSlot => {
      const slot = id as ResolvedSlot['slot'];
      const s = map.get(id);
      return s
        ? { slot, value: s.value, source: 'business_facts', confidence: 1, status: s.status as ResolvedSlot['status'] }
        : { slot, value: null, source: null, confidence: 0, status: 'missing' };
    })) as RunMarketingAuditDeps['resolve'];
}

let savedCounter = 0;
function makeSaveStub(record: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }>): RunMarketingAuditDeps['saveArtifact'] {
  return (async (kind: ArtifactKind, content: unknown, opts: SaveArtifactOptions): Promise<ArtifactRow> => {
    record.push({ kind, content, opts });
    savedCounter += 1;
    return {
      id: `art-${savedCounter}`, user_id: 'user-1', avatar_id: opts.avatarId ?? null, kind, content,
      grounding: opts.grounding, evidence_refs: opts.evidenceRefs, superseded_by: null, created_at: new Date().toISOString(),
    };
  }) as RunMarketingAuditDeps['saveArtifact'];
}

function makeAuditSaveStub(record: Array<{ constraints: unknown; investments: unknown; rollout: unknown }>): RunMarketingAuditDeps['saveMarketingAudit'] {
  return (async (input: { constraints: unknown; investments: unknown; rollout: unknown }): Promise<MarketingAuditRow> => {
    record.push(input);
    return { id: 'audit-1', user_id: 'user-1', ...input, created_at: new Date().toISOString() };
  }) as RunMarketingAuditDeps['saveMarketingAudit'];
}

afterEach(() => vi.restoreAllMocks());

// ======================================================================================
// parseBusinessFacts — revenue gate + tolerant parse.
// ======================================================================================
describe('parseBusinessFacts', () => {
  it('parses the seeded IV facts into a calibration bundle', () => {
    const r = parseBusinessFacts(ivFactSlots());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.facts.monthlyRevenue).toBe(10000);
    expect(r.facts.marginTarget).toBeCloseTo(0.1);
    expect(r.facts.assets.brandRegistry).toBe(true);
    expect(r.facts.channels.tcgOrHobbyNiche).toBe(true);
    expect(r.facts.inventoryRisk).toBe(true);
    expect(r.facts.cashTiming.tightCash).toBe(true);
    expect(r.facts.runningPpc).toBe(true);
  });

  it('returns a needs-input gap on slot #8 when revenue is missing (nothing invented)', () => {
    const slots = ivFactSlots({ 8: null });
    const r = parseBusinessFacts(slots);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.gaps.some((g) => g.slot === 8)).toBe(true);
  });

  it('returns a gap when revenue is present but unparseable', () => {
    const r = parseBusinessFacts(ivFactSlots({ 8: { monthlyRevenue: 'not a number' } }));
    expect(r.ok).toBe(false);
  });

  it('parses a "$10,000" / "10k" style revenue string', () => {
    expect((parseBusinessFacts(ivFactSlots({ 8: { revenue: '$10,000' } })) as { ok: true; facts: CalibrationFacts }).facts.monthlyRevenue).toBe(10000);
    expect((parseBusinessFacts(ivFactSlots({ 8: { revenue: '10k' } })) as { ok: true; facts: CalibrationFacts }).facts.monthlyRevenue).toBe(10000);
  });

  it('ignores a stale/missing-status slot value (does not read it)', () => {
    const slots = ivFactSlots();
    const eight = slots.find((s) => s.slot === 8)!;
    eight.status = 'stale';
    const r = parseBusinessFacts(slots);
    expect(r.ok).toBe(false); // stale revenue is not usable → gap
  });
});

// ======================================================================================
// Tiering — reproduces the gold tiers for the IV facts.
// ======================================================================================
describe('tierFor — reproduces gold tiering for the IV facts', () => {
  it('keeps every gold move at its gold tier for a comparable business', () => {
    const facts = ivFacts();
    for (const row of goldRows) {
      const move = MARKETING_MOVE_LIBRARY.find((m) => m.name === row[1])!;
      expect(move, `library move for "${String(row[1])}"`).toBeTruthy();
      expect(tierFor(move, facts), `tier for ${move.id}`).toBe(row[0]);
    }
  });

  it('the built matrix has the same tier for every move as the gold matrix', () => {
    const { rows } = buildInvestmentRows(ivFacts());
    expect(rows.length).toBe(goldRows.length);
    const goldTierByName = new Map(goldRows.map((r) => [r[1] as string, r[0] as string]));
    for (const row of rows) {
      expect(row.tier, `tier for ${row.investment}`).toBe(goldTierByName.get(row.investment));
    }
  });

  it('defers a free-path T1 move to T2 when its FOUNDATION prerequisite is unmet', () => {
    // SBV defaults to T2 (so it never re-tiers); pick a T1 move with a foundation prereq.
    // Brand Story needs a storefront — without one it defers from T1 to T2.
    const facts = parseBusinessFacts(ivFactSlots({ 7: { brandRegistry: true, storefront: false } }));
    if (!facts.ok) throw new Error('facts');
    const brandStory = getMarketingMove('brand-story-storefront');
    expect(tierFor(brandStory, facts.facts)).toBe('T2');
  });

  it('defers a cash-needing T1 move to T2 under tight cash (no free path)', () => {
    // Construct a hypothetical: tight cash pushes a T1 move with no free path to T2.
    // (All gold T1 moves have a free path, so this exercises the rule directly.)
    const facts = ivFacts();
    const fakeCashMove = { ...getMarketingMove('aplus-content-overhaul'), cash_cost_model: { kind: 'one_time' as const, verbatim: '$300 designer only' }, prerequisites: [] as never[] };
    expect(tierFor(fakeCashMove, facts)).toBe('T2');
  });
});

// ======================================================================================
// Benefit calibration — reproduces gold benefit bands @ $10K/mo.
// ======================================================================================
describe('calibrate — benefit bands reproduce the gold matrix @ $10K/mo', () => {
  it('renders the A+ overhaul gold band exactly (anchor row)', () => {
    const { rows } = buildInvestmentRows(ivFacts());
    const aplus = rows.find((r) => r.investment === 'A+ Content overhaul (all 3 listings)')!;
    expect(aplus.benefit_1mo).toBe('+$200–500');
    expect(aplus.benefit_3mo).toBe('+$900–1,800');
    expect(aplus.benefit_6mo).toBe('+$2,000–4,200');
    expect(aplus.benefit_12mo).toBe('+$4,500–9,000');
  });

  it('scales every numeric band linearly when revenue doubles', () => {
    const base = buildInvestmentRows(ivFacts());
    const doubled = buildInvestmentRows({ ...ivFacts(), monthlyRevenue: 20000 });
    const aplusBase = base.rows.find((r) => r.investment.startsWith('A+'))!;
    const aplusDouble = doubled.rows.find((r) => r.investment.startsWith('A+'))!;
    expect(aplusBase.benefit_1mo).toBe('+$200–500');
    expect(aplusDouble.benefit_1mo).toBe('+$400–1,000');
  });

  it('preserves the gold qualitative cells verbatim (no fabricated dollars)', () => {
    const { rows } = buildInvestmentRows(ivFacts());
    const ppc = rows.find((r) => r.investment === 'Restructure PPC per the campaign plan')!;
    expect(ppc.benefit_1mo).toBe('Saves ~$168 + recovers margin');
    const sd = rows.find((r) => r.investment.startsWith('Sponsored Display audience'))!;
    expect(sd.benefit_1mo).toBe('−$100 (test loss likely)');
  });
});

// ======================================================================================
// Phasing — reproduces the gold 90-day rollout sequencing.
// ======================================================================================
describe('calibrate — rollout phasing reproduces the gold sequencing', () => {
  it('produces four phases sequenced around the cash timeline', () => {
    const { phases } = calibrate(ivFacts());
    expect(phases).toHaveLength(4);
    expect(phases[0].window).toMatch(/inventory/i);
    expect(phases[1].window).toMatch(/repayment/i);
  });

  it('front-loads the gold Phase-1 bleed-stop moves into Phase 1', () => {
    const { phases } = calibrate(ivFacts());
    const p1 = phases[0].action;
    expect(p1).toMatch(/Restructure PPC/);
    expect(p1).toMatch(/Listing copy/);
    expect(p1).toMatch(/Brand Referral Bonus/);
    expect(p1).toMatch(/photography/i);
    // The A+ overhaul is sequenced in Phase 2 (gold), not Phase 1.
    expect(p1).not.toMatch(/A\+ Content/);
    expect(phases[1].action).toMatch(/A\+ Content/);
  });

  it('defers TikTok Shop + email list to Phase 4 (new channels last)', () => {
    const { phases } = calibrate(ivFacts());
    expect(phases[3].action).toMatch(/TikTok Shop/);
    expect(phases[3].action).toMatch(/Email list/);
  });

  it('Phase 1 needs no cash; later phases carry the verbatim per-move cash', () => {
    const { phases } = calibrate(ivFacts());
    expect(phases[0].cash_needed).toBe('$0');
    expect(phases[1].cash_needed).toMatch(/Vine|\$200/);
  });
});

// ======================================================================================
// Cumulative-impact grid — reproduces the gold grid @ $10K/mo.
// ======================================================================================
describe('calibrate — cumulative-impact grid reproduces the gold grid @ $10K/mo', () => {
  it('reproduces the gold cumulative-impact low/mid/high within ±15%', () => {
    const goldGrid = wbB.sheets[1].tables.find((t) => t.name?.startsWith('Cumulative impact'))!;
    const { cumulativeImpact } = calibrate(ivFacts());
    expect(CALIBRATION_BASELINE_REVENUE).toBe(10000);
    // goldGrid.rows: [Horizon, Low, Mid, High, Notes].
    goldGrid.rows.forEach((goldRow, i) => {
      const row = cumulativeImpact[i];
      expect(row.horizon).toBe(goldRow[0]);
      const within = (a: number, e: number) => Math.abs(a - e) <= Math.abs(e) * 0.15;
      expect(within(row.low, goldRow[1] as number), `${row.horizon} low: ${row.low} vs ${goldRow[1]}`).toBe(true);
      expect(within(row.mid, goldRow[2] as number), `${row.horizon} mid: ${row.mid} vs ${goldRow[2]}`).toBe(true);
      expect(within(row.high, goldRow[3] as number), `${row.horizon} high: ${row.high} vs ${goldRow[3]}`).toBe(true);
    });
  });
});

// ======================================================================================
// runMarketingAudit — orchestration: gate, calibrate, prose, persist.
// ======================================================================================
describe('runMarketingAudit', () => {
  function deps(over: Partial<RunMarketingAuditDeps> = {}): Partial<RunMarketingAuditDeps> {
    return {
      resolve: over.resolve ?? makeResolve(ivFactSlots()),
      saveArtifact: over.saveArtifact ?? makeSaveStub([]),
      saveMarketingAudit: over.saveMarketingAudit ?? makeAuditSaveStub([]),
      edgeFn: over.edgeFn ?? stubEdgeFn(null), // default: prose fn unavailable → verbatim
    };
  }

  it('returns needs_input (slot #8) when revenue is missing — nothing persisted', async () => {
    const savedArtifacts: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const savedAudits: Array<{ constraints: unknown; investments: unknown; rollout: unknown }> = [];
    const res = await runMarketingAudit(null, deps({
      resolve: makeResolve(ivFactSlots({ 8: null })),
      saveArtifact: makeSaveStub(savedArtifacts),
      saveMarketingAudit: makeAuditSaveStub(savedAudits),
    }));
    expect(res.status).toBe('needs_input');
    if (res.status !== 'needs_input') return;
    expect(res.needs_input.some((n) => n.slot === 8)).toBe(true);
    expect(savedArtifacts).toHaveLength(0);
    expect(savedAudits).toHaveLength(0);
  });

  it('persists the audit + rollout artifacts and the marketing_audits row (verbatim prose)', async () => {
    const savedArtifacts: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const savedAudits: Array<{ constraints: unknown; investments: unknown; rollout: unknown }> = [];
    const res = await runMarketingAudit(null, deps({
      saveArtifact: makeSaveStub(savedArtifacts),
      saveMarketingAudit: makeAuditSaveStub(savedAudits),
    }));
    expect(res.status).toBe('persisted');
    if (res.status !== 'persisted') return;
    expect(res.rowCount).toBe(goldRows.length);
    expect(res.phaseCount).toBe(4);
    expect(res.prose).toBe('verbatim');
    expect(savedAudits).toHaveLength(1);
    expect(savedArtifacts.map((a) => a.kind)).toEqual(['marketing_audit', 'rollout_plan']);
    const audit = savedArtifacts[0].content as MarketingAuditOutput;
    expect(audit.grounding).toBe('evidence');
    expect(audit.evidence_refs.length).toBeGreaterThan(0);
    const rollout = savedArtifacts[1].content as RolloutPlanOutput;
    expect(rollout.cumulative_impact).toHaveLength(4);
  });

  it('enriches PROSE only — numbers in == numbers out (the gold guarantee)', async () => {
    const savedArtifacts: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    // The deterministic A+ band BEFORE the fn runs.
    const expected = buildInvestmentRows(ivFacts()).rows.find((r) => r.investment.startsWith('A+'))!;
    // A prose fn that rewrites every description AND maliciously injects a fake dollar
    // figure into the prose. The tool must adopt the new DESCRIPTION but keep the bands.
    const rowCount = expected ? buildInvestmentRows(ivFacts()).rows.length : 0;
    const proseReply = {
      row_descriptions: Array.from({ length: rowCount }, (_, i) => `Rewritten description ${i} promising +$999,999.`),
      phase_why_now: ['why 1', 'why 2', 'why 3', 'why 4'],
    };
    const res = await runMarketingAudit(null, deps({
      saveArtifact: makeSaveStub(savedArtifacts),
      edgeFn: stubEdgeFn(proseReply),
    }));
    expect(res.status).toBe('persisted');
    if (res.status !== 'persisted') return;
    expect(res.prose).toBe('enriched');
    const audit = savedArtifacts[0].content as MarketingAuditOutput;
    const aplus = audit.rows.find((r) => r.investment.startsWith('A+'))!;
    // Description IS the model's rewrite...
    expect(aplus.what_it_is).toMatch(/Rewritten description/);
    // ...but every NUMBER band is the deterministic value, untouched by the model.
    expect(aplus.benefit_1mo).toBe(expected.benefit_1mo);
    expect(aplus.benefit_3mo).toBe(expected.benefit_3mo);
    expect(aplus.benefit_6mo).toBe(expected.benefit_6mo);
    expect(aplus.benefit_12mo).toBe(expected.benefit_12mo);
    expect(aplus.cash_cost).toBe(expected.cash_cost);
    expect(aplus.tier).toBe(expected.tier);
  });

  it('keeps verbatim prose when the prose fn is unavailable (never-fail)', async () => {
    const savedArtifacts: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const res = await runMarketingAudit(null, deps({ saveArtifact: makeSaveStub(savedArtifacts), edgeFn: stubEdgeFn({ fail: true }) }));
    expect(res.status).toBe('persisted');
    if (res.status !== 'persisted') return;
    expect(res.prose).toBe('verbatim');
    const audit = savedArtifacts[0].content as MarketingAuditOutput;
    const aplus = audit.rows.find((r) => r.investment.startsWith('A+'))!;
    expect(aplus.what_it_is).toBe(getMarketingMove('aplus-content-overhaul').what_it_is);
  });
});

// ======================================================================================
// Tool surface — identity gate via the MCP transport.
// ======================================================================================
describe('run_marketing_audit tool surface', () => {
  async function connect(register: (s: McpServer) => void): Promise<Client> {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    register(server);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
    return client;
  }

  it('denies anonymous callers before any work', async () => {
    const client = await connect((s) =>
      registerRunMarketingAuditTool(s, {
        resolve: makeResolve(ivFactSlots()),
        saveArtifact: makeSaveStub([]),
        saveMarketingAudit: makeAuditSaveStub([]),
        edgeFn: stubEdgeFn(null),
      }),
    );
    const res = await client.callTool({ name: 'run_marketing_audit', arguments: {} });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/unauthenticated/i);
  });

  it('runs the audit for an authenticated caller and persists', async () => {
    const savedArtifacts: Array<{ kind: ArtifactKind; content: unknown; opts: SaveArtifactOptions }> = [];
    const savedAudits: Array<{ constraints: unknown; investments: unknown; rollout: unknown }> = [];
    const client = await connect((s) =>
      registerRunMarketingAuditTool(s, {
        resolve: makeResolve(ivFactSlots()),
        saveArtifact: makeSaveStub(savedArtifacts),
        saveMarketingAudit: makeAuditSaveStub(savedAudits),
        edgeFn: stubEdgeFn(null),
      }),
    );
    const res = await runWithIdentity(authed, () => client.callTool({ name: 'run_marketing_audit', arguments: {} }));
    const sc = res.structuredContent as { ok: boolean; row_count?: number; phase_count?: number };
    expect(sc.ok).toBe(true);
    expect(sc.row_count).toBe(goldRows.length);
    expect(sc.phase_count).toBe(4);
    expect(savedAudits).toHaveLength(1);
  });

  it('returns needs_input for an authenticated caller when revenue is missing', async () => {
    const client = await connect((s) =>
      registerRunMarketingAuditTool(s, {
        resolve: makeResolve(ivFactSlots({ 8: null })),
        saveArtifact: makeSaveStub([]),
        saveMarketingAudit: makeAuditSaveStub([]),
        edgeFn: stubEdgeFn(null),
      }),
    );
    const res = await runWithIdentity(authed, () => client.callTool({ name: 'run_marketing_audit', arguments: {} }));
    const sc = res.structuredContent as { ok: boolean; needs_input?: Array<{ slot: number }> };
    expect(sc.ok).toBe(false);
    expect(sc.needs_input?.some((n) => n.slot === 8)).toBe(true);
  });
});
