// @vitest-environment node
/**
 * Phase 6 Agent C — `export_workbook` tool test.
 *
 * The assemblers are already cell-structure tested against the gold fixtures
 * (workbookA.test.ts / workbookB.test.ts). This suite tests the TOOL layer:
 *
 *  1. round-trip: stubbed store/audit → runExportWorkbook → a real .xlsx buffer is
 *     written through the injected writeFile (asserted via the PK zip magic header).
 *  2. needs_input: an empty chain (A) / no audit (B) returns needs_input listing the
 *     missing artifacts and writes NOTHING.
 *  3. upload never-fail: upload:true with a degraded uploader still exports the local
 *     file and annotates `uploaded.ok=false` (clones the draft_asset degraded-write).
 *  4. failed: a contract-violating persisted record surfaces status:'failed' (the
 *     assembler throws, the tool catches).
 *  5. tool surface: anonymous callers are denied (gateWrite) before any work; an
 *     authenticated caller exports through the MCP transport.
 *
 * Everything is stubbed — no Supabase, no real filesystem write (writeFile is injected),
 * no network — so the suite is deterministic and hermetic.
 */
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  runExportWorkbook,
  registerExportWorkbookTool,
  type ExportWorkbookDeps,
  type UploadResult,
} from '../tools/exportWorkbook.js';
import type { ArtifactRow } from '../service/artifactStore.js';
import type {
  ArtifactKind,
  PositioningStatementOutput,
  MarketingAuditOutput,
  RolloutPlanOutput,
} from '../contracts/index.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

// --- Fixtures -------------------------------------------------------------------------

/** A contract-valid chosen Positioning Statement (the simplest single-sheet Workbook A chain). */
const POSITIONING_STATEMENT_CONTENT: PositioningStatementOutput = {
  options: [
    { option: 1, sentence: 'Built for collectors who refuse to compromise.' },
    { option: 2, sentence: 'The vault your cards deserve.' },
  ],
  chosen_option: 1,
  grounding: 'inference',
  evidence_refs: [],
};

/** A contract-valid marketing audit (Investment Matrix) — one move row. */
const AUDIT_CONTENT: MarketingAuditOutput = {
  rows: [
    {
      tier: 'T1',
      investment: 'Listing copy overhaul',
      what_it_is: 'Rewrite title + bullets against decision triggers.',
      calendar_time: '2 days',
      person_hours: '6 hrs',
      level_of_effort: 'Low',
      cash_cost: '$0',
      benefit_1mo: '$500–900',
      benefit_3mo: '$1,800–3,200',
      benefit_6mo: '$4,500–8,000',
      benefit_12mo: '$11,000–20,000',
    },
  ],
  grounding: 'evidence',
  evidence_refs: [{ kind: 'business_fact', ref: 'revenue (slot #8)' }],
};

/** A contract-valid rollout plan (Recommended Phasing) — one phase + one horizon. */
const ROLLOUT_CONTENT: RolloutPlanOutput = {
  phases: [
    {
      phase: 'Phase 1',
      window: 'Now → end of inventory-order window',
      action: 'Listing copy overhaul + reviews request.',
      cash_needed: '$0',
      why_now: 'Free leverage that compounds before paid moves.',
    },
  ],
  cumulative_impact: [
    { horizon: 'Month 1', low: 500, mid: 900, high: 1500, notes: 'Copy lift only.' },
  ],
  grounding: 'evidence',
  evidence_refs: [{ kind: 'business_fact', ref: 'revenue (slot #8)' }],
};

// --- Stubs ----------------------------------------------------------------------------

let rowCounter = 0;
function artifactRow(kind: ArtifactKind, content: unknown): ArtifactRow {
  rowCounter += 1;
  return {
    id: `art-${rowCounter}`,
    user_id: 'user-1',
    avatar_id: null,
    kind,
    content,
    grounding: 'inference',
    evidence_refs: [],
    superseded_by: null,
    created_at: new Date().toISOString(),
  };
}

/** getChain stub returning a fixed set of current artifact rows. */
function makeGetChain(rows: ArtifactRow[]): ExportWorkbookDeps['getChain'] {
  return (async () => rows) as ExportWorkbookDeps['getChain'];
}

/** getCurrentMarketingAudit stub. */
function makeGetAudit(
  record: { investments: unknown; rollout: unknown } | null,
): ExportWorkbookDeps['getCurrentMarketingAudit'] {
  return (async () => record) as ExportWorkbookDeps['getCurrentMarketingAudit'];
}

/** A capturing writeFile stub: records the path + buffer instead of touching disk. */
function makeWriteCapture(): {
  writeFile: ExportWorkbookDeps['writeFile'];
  calls: Array<{ path: string; buffer: Buffer }>;
} {
  const calls: Array<{ path: string; buffer: Buffer }> = [];
  const writeFile: ExportWorkbookDeps['writeFile'] = async (path, buffer) => {
    calls.push({ path, buffer });
  };
  return { writeFile, calls };
}

const okUpload: ExportWorkbookDeps['uploadWorkbook'] = async (objectPath): Promise<UploadResult> => ({
  ok: true,
  path: objectPath,
});
const degradedUpload: ExportWorkbookDeps['uploadWorkbook'] = async (): Promise<UploadResult> => ({
  ok: false,
  note: "Storage bucket 'workbooks' unavailable",
});

/** A capturing ensureDir stub: records the dirs requested instead of touching disk. */
function makeEnsureDirCapture(): { ensureDir: ExportWorkbookDeps['ensureDir']; dirs: string[] } {
  const dirs: string[] = [];
  const ensureDir: ExportWorkbookDeps['ensureDir'] = async (dirPath) => {
    dirs.push(dirPath);
  };
  return { ensureDir, dirs };
}

function deps(over: Partial<ExportWorkbookDeps>): Partial<ExportWorkbookDeps> {
  return {
    getChain: over.getChain ?? makeGetChain([]),
    getCurrentMarketingAudit: over.getCurrentMarketingAudit ?? makeGetAudit(null),
    uploadWorkbook: over.uploadWorkbook ?? okUpload,
    ensureDir: over.ensureDir ?? (async () => {}),
    writeFile: over.writeFile ?? (async () => {}),
  };
}

/** The .xlsx (zip) magic header — first two bytes are 'P','K' (0x50 0x4B). */
function isXlsxBuffer(buffer: Buffer): boolean {
  return buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

// ======================================================================================
// runExportWorkbook — Workbook A
// ======================================================================================
describe('runExportWorkbook (Workbook A)', () => {
  it('renders + writes a valid .xlsx from a positioning statement-only chain', async () => {
    const cap = makeWriteCapture();
    const chain = [artifactRow('positioning_statement', POSITIONING_STATEMENT_CONTENT)];
    const res = await runExportWorkbook(
      { which: 'A', outDir: '/tmp/test-out' },
      deps({ getChain: makeGetChain(chain), writeFile: cap.writeFile }),
    );
    expect(res.status).toBe('exported');
    if (res.status !== 'exported') return;
    // The avatar sheet renders from the positioning statement artifact.
    expect(res.sheets).toContain('4. Avatar 2.0 (IV)');
    expect(res.path.endsWith('.xlsx')).toBe(true);
    expect(res.path.startsWith('/tmp/test-out')).toBe(true);
    // missing lists every Workbook A kind absent from the chain (all but positioning statement).
    expect(res.missing).toContain('brand_canvas');
    expect(res.missing).not.toContain('positioning_statement');
    // The buffer actually written is a valid xlsx (PK zip magic).
    expect(cap.calls).toHaveLength(1);
    expect(isXlsxBuffer(cap.calls[0].buffer)).toBe(true);
  });

  it('weaves a custom brand name into the filename', async () => {
    const cap = makeWriteCapture();
    const chain = [artifactRow('positioning_statement', POSITIONING_STATEMENT_CONTENT)];
    const res = await runExportWorkbook(
      { which: 'A', outDir: '/tmp/test-out', brandName: 'Acme Cards' },
      deps({ getChain: makeGetChain(chain), writeFile: cap.writeFile }),
    );
    expect(res.status).toBe('exported');
    if (res.status !== 'exported') return;
    expect(res.path).toContain('Acme-Cards');
  });

  it('returns needs_input (and writes nothing) when the chain is empty', async () => {
    const cap = makeWriteCapture();
    const res = await runExportWorkbook(
      { which: 'A' },
      deps({ getChain: makeGetChain([]), writeFile: cap.writeFile }),
    );
    expect(res.status).toBe('needs_input');
    if (res.status !== 'needs_input') return;
    expect(res.which).toBe('A');
    expect(res.missing.length).toBeGreaterThan(0);
    expect(res.missing).toContain('diagnostic_interpretation');
    expect(cap.calls).toHaveLength(0);
  });

  it('ensures the out_dir exists (mkdir -p) BEFORE writing the file (R3)', async () => {
    const cap = makeWriteCapture();
    const dirCap = makeEnsureDirCapture();
    const chain = [artifactRow('positioning_statement', POSITIONING_STATEMENT_CONTENT)];
    const res = await runExportWorkbook(
      { which: 'A', outDir: '/tmp/does/not/exist/yet' },
      deps({ getChain: makeGetChain(chain), writeFile: cap.writeFile, ensureDir: dirCap.ensureDir }),
    );
    expect(res.status).toBe('exported');
    if (res.status !== 'exported') return;
    // The nonexistent nested dir was ensured, exactly once, and the write landed inside it.
    expect(dirCap.dirs).toEqual(['/tmp/does/not/exist/yet']);
    expect(cap.calls).toHaveLength(1);
    expect(cap.calls[0].path.startsWith('/tmp/does/not/exist/yet')).toBe(true);
  });

  it('exports into a genuinely nonexistent nested dir via the real mkdir -p default (R3, fs)', async () => {
    // No ensureDir/writeFile injected — exercise the production defaults against a real,
    // nonexistent nested path (the gap-report ENOENT scenario). Then read it back.
    const base = await mkdtemp(path.join(os.tmpdir(), 'export-r3-'));
    const nested = path.join(base, 'a', 'b', 'c'); // does not exist yet
    try {
      const chain = [artifactRow('positioning_statement', POSITIONING_STATEMENT_CONTENT)];
      const res = await runExportWorkbook(
        { which: 'A', outDir: nested },
        { getChain: makeGetChain(chain) },
      );
      expect(res.status).toBe('exported');
      if (res.status !== 'exported') return;
      const onDisk = await readFile(res.path);
      expect(isXlsxBuffer(onDisk)).toBe(true);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});

// ======================================================================================
// runExportWorkbook — Workbook B
// ======================================================================================
describe('runExportWorkbook (Workbook B)', () => {
  it('renders + writes a valid .xlsx from the persisted audit row', async () => {
    const cap = makeWriteCapture();
    const res = await runExportWorkbook(
      { which: 'B', outDir: '/tmp/test-out' },
      deps({
        getCurrentMarketingAudit: makeGetAudit({ investments: AUDIT_CONTENT, rollout: ROLLOUT_CONTENT }),
        writeFile: cap.writeFile,
      }),
    );
    expect(res.status).toBe('exported');
    if (res.status !== 'exported') return;
    expect(res.sheets).toEqual(['Investment Matrix', 'Recommended Phasing']);
    expect(res.path).toContain('Marketing-Investment-Audit');
    expect(cap.calls).toHaveLength(1);
    expect(isXlsxBuffer(cap.calls[0].buffer)).toBe(true);
  });

  it('returns needs_input (and writes nothing) when no audit has been run', async () => {
    const cap = makeWriteCapture();
    const res = await runExportWorkbook(
      { which: 'B' },
      deps({ getCurrentMarketingAudit: makeGetAudit(null), writeFile: cap.writeFile }),
    );
    expect(res.status).toBe('needs_input');
    if (res.status !== 'needs_input') return;
    expect(res.which).toBe('B');
    expect(res.missing).toEqual(['marketing_audit', 'rollout_plan']);
    expect(cap.calls).toHaveLength(0);
  });

  it('surfaces status:failed when the persisted audit jsonb violates the contract', async () => {
    const cap = makeWriteCapture();
    const res = await runExportWorkbook(
      { which: 'B' },
      deps({
        // `rows` empty fails marketingAuditOutputSchema (min(1)) — the assembler throws.
        getCurrentMarketingAudit: makeGetAudit({ investments: { rows: [], grounding: 'inference', evidence_refs: [] }, rollout: ROLLOUT_CONTENT }),
        writeFile: cap.writeFile,
      }),
    );
    expect(res.status).toBe('failed');
    if (res.status !== 'failed') return;
    expect(res.note).toMatch(/marketing_audit/);
    expect(cap.calls).toHaveLength(0);
  });
});

// ======================================================================================
// Optional never-fail upload
// ======================================================================================
describe('runExportWorkbook upload (never-fail)', () => {
  it('still exports the local file when the storage upload degrades', async () => {
    const cap = makeWriteCapture();
    const chain = [artifactRow('positioning_statement', POSITIONING_STATEMENT_CONTENT)];
    const res = await runWithIdentity(authed, () =>
      runExportWorkbook(
        { which: 'A', upload: true },
        deps({ getChain: makeGetChain(chain), writeFile: cap.writeFile, uploadWorkbook: degradedUpload }),
      ),
    );
    expect(res.status).toBe('exported');
    if (res.status !== 'exported') return;
    expect(cap.calls).toHaveLength(1); // local file still written
    expect(res.uploaded?.ok).toBe(false);
    expect(res.uploaded?.note).toMatch(/unavailable/i);
  });

  it('records a successful upload path under the caller id', async () => {
    const cap = makeWriteCapture();
    const chain = [artifactRow('positioning_statement', POSITIONING_STATEMENT_CONTENT)];
    const res = await runWithIdentity(authed, () =>
      runExportWorkbook(
        { which: 'A', upload: true },
        deps({ getChain: makeGetChain(chain), writeFile: cap.writeFile, uploadWorkbook: okUpload }),
      ),
    );
    expect(res.status).toBe('exported');
    if (res.status !== 'exported') return;
    expect(res.uploaded?.ok).toBe(true);
    expect(res.uploaded?.path).toContain('user-1/');
  });

  it('does not upload when upload is omitted', async () => {
    let uploadCalled = false;
    const cap = makeWriteCapture();
    const chain = [artifactRow('positioning_statement', POSITIONING_STATEMENT_CONTENT)];
    const res = await runExportWorkbook(
      { which: 'A' },
      deps({
        getChain: makeGetChain(chain),
        writeFile: cap.writeFile,
        uploadWorkbook: async () => {
          uploadCalled = true;
          return { ok: true };
        },
      }),
    );
    expect(res.status).toBe('exported');
    if (res.status !== 'exported') return;
    expect(uploadCalled).toBe(false);
    expect(res.uploaded).toBeUndefined();
  });
});

// ======================================================================================
// Tool surface — identity gate via the MCP transport
// ======================================================================================
describe('export_workbook tool surface', () => {
  async function connect(register: (s: McpServer) => void): Promise<Client> {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    register(server);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([server.connect(st), client.connect(ct)]);
    return client;
  }

  it('denies anonymous callers before any work (gateWrite)', async () => {
    const cap = makeWriteCapture();
    const client = await connect((s) =>
      registerExportWorkbookTool(s, deps({ getChain: makeGetChain([artifactRow('positioning_statement', POSITIONING_STATEMENT_CONTENT)]), writeFile: cap.writeFile })),
    );
    const res = await client.callTool({ name: 'export_workbook', arguments: { which: 'A' } });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/unauthenticated/i);
    expect(cap.calls).toHaveLength(0); // gate ran before the assembler
  });

  it('exports for an authenticated caller and echoes the path + sheets', async () => {
    const cap = makeWriteCapture();
    const chain = [artifactRow('positioning_statement', POSITIONING_STATEMENT_CONTENT)];
    const client = await connect((s) =>
      registerExportWorkbookTool(s, deps({ getChain: makeGetChain(chain), writeFile: cap.writeFile })),
    );
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'export_workbook', arguments: { which: 'A', out_dir: '/tmp/test-out' } }),
    );
    const sc = res.structuredContent as { ok: boolean; path: string; sheets: string[]; missing: string[] };
    expect(sc.ok).toBe(true);
    expect(sc.path.endsWith('.xlsx')).toBe(true);
    expect(sc.sheets).toContain('4. Avatar 2.0 (IV)');
    expect(cap.calls).toHaveLength(1);
    expect(isXlsxBuffer(cap.calls[0].buffer)).toBe(true);
  });

  it('returns needs_input through the tool surface when the chain is empty', async () => {
    const client = await connect((s) => registerExportWorkbookTool(s, deps({ getChain: makeGetChain([]) })));
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'export_workbook', arguments: { which: 'A' } }),
    );
    const sc = res.structuredContent as { ok: boolean; needs_input: boolean; missing: string[] };
    expect(sc.ok).toBe(false);
    expect(sc.needs_input).toBe(true);
    expect(sc.missing.length).toBeGreaterThan(0);
  });
});
