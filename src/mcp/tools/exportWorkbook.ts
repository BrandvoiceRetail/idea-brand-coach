/**
 * Layer 2 (tool) — `export_workbook` (OWNED, WRITE, gateWrite — Phase 6 Agent C).
 *
 * The terminal tool of the output engine: it turns the PERSISTED artifact chain into one
 * of the two Trevor-approved gold .xlsx workbooks and returns a local file path. It does
 * NOT regenerate anything (manifest §3 / Phase-6 rule) — the assemblers (`assembleWorkbookA`
 * / `assembleWorkbookB`) are pure over already-persisted content, so the export is a read +
 * render + write only:
 *
 *   which:'A' → read the full artifact chain (`getChain`), project it to the Workbook A
 *               subset, and render the gold Mockup workbook. If the chain holds no
 *               renderable artifact yet, return needs_input listing the missing kinds —
 *               nothing is written.
 *   which:'B' → read the current `marketing_audits` row (`investments` / `rollout` jsonb)
 *               and render the gold Marketing Investment Audit workbook. If no audit has
 *               been run, return needs_input.
 *
 * IDENTITY: gateWrite() denies anonymous callers before any work (every read here uses the
 * JWT-bound RLS client, and the optional Storage upload is a write). The file is written to
 * `out_dir` || `os.tmpdir()` with a descriptive, brand-prefixed filename.
 *
 * OPTIONAL UPLOAD (never-fail): `upload:true` mirrors the draft_asset pattern — the rendered
 * buffer is uploaded to a Supabase Storage bucket and the result annotates
 * `structuredContent.uploaded`; a degraded/absent bucket NEVER fails the export (the local
 * file is the deliverable). No IV-OS echo here — log_asset is a copy-asset ledger, not a
 * file store.
 */
import os from 'node:os';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type ExcelJS from 'exceljs';
import {
  assembleWorkbookA,
  projectWorkbookAArtifacts,
} from '../service/workbook/assembleWorkbookA.js';
import {
  assembleWorkbookB,
  type MarketingAuditRecord,
} from '../service/workbook/assembleWorkbookB.js';
import { getChain as getChainLive, type ArtifactRow } from '../service/artifactStore.js';
import { getUserSupabase } from '../supabaseUser.js';
import type { ArtifactKind } from '../contracts/index.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

/** The artifact kinds Workbook A can render (the union over its five sheets). */
const WORKBOOK_A_KINDS: readonly ArtifactKind[] = [
  'diagnostic_interpretation',
  'avatar_s1_vocab',
  'avatar_s2_jobmap',
  'avatar_s3_triggers',
  'avatar_s4_objections',
  'signature',
  'brand_canvas',
  'export_brief',
  'audit_x_idea',
];

/** The sheet names each assembler emits, for the tool's `sheets` echo. */
type SheetNames = string[];

/** The persisted `marketing_audits` row this tool reads for Workbook B. */
interface MarketingAuditRowLite {
  investments: unknown;
  rollout: unknown;
}

/**
 * Read the most recent `marketing_audits` row for the caller (RLS-scoped to auth.uid()),
 * or `null` if the user has never run an audit. Injectable so the tool is unit-testable
 * without a DB. Distinct from the artifact chain: Output B has its own dedicated store.
 */
export async function getCurrentMarketingAudit(): Promise<MarketingAuditRowLite | null> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from('marketing_audits')
    .select('investments, rollout')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`failed to read marketing_audits: ${error.message}`);
  }
  return (data as MarketingAuditRowLite | null) ?? null;
}

/**
 * Upload a rendered workbook buffer to Supabase Storage (never-fail). Returns a structured
 * note rather than throwing: a missing/denied bucket degrades the upload, never the export.
 * Injectable for tests.
 */
export interface UploadResult {
  ok: boolean;
  path?: string;
  note?: string;
}

const STORAGE_BUCKET = 'workbooks';

export async function uploadWorkbook(objectPath: string, buffer: Buffer): Promise<UploadResult> {
  try {
    const supabase = getUserSupabase();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });
    if (error || !data) {
      return { ok: false, note: error?.message ?? `Storage bucket '${STORAGE_BUCKET}' unavailable` };
    }
    return { ok: true, path: data.path };
  } catch (err) {
    return { ok: false, note: err instanceof Error ? err.message : 'storage upload degraded' };
  }
}

/** Injectable collaborators (default to the live module fns) so the tool is unit-testable. */
export interface ExportWorkbookDeps {
  getChain: typeof getChainLive;
  getCurrentMarketingAudit: typeof getCurrentMarketingAudit;
  uploadWorkbook: typeof uploadWorkbook;
  /** Ensure the out dir exists before writing (recursive mkdir -p); injectable for tests. */
  ensureDir: (dirPath: string) => Promise<void>;
  /** Buffer → disk; injectable so tests assert the round-trip without real fs writes. */
  writeFile: (filePath: string, buffer: Buffer) => Promise<void>;
}

function withDefaults(deps?: Partial<ExportWorkbookDeps>): ExportWorkbookDeps {
  return {
    getChain: deps?.getChain ?? getChainLive,
    getCurrentMarketingAudit: deps?.getCurrentMarketingAudit ?? getCurrentMarketingAudit,
    uploadWorkbook: deps?.uploadWorkbook ?? uploadWorkbook,
    ensureDir: deps?.ensureDir ?? (async (dirPath) => { await mkdir(dirPath, { recursive: true }); }),
    writeFile: deps?.writeFile ?? ((filePath, buffer) => writeFile(filePath, buffer)),
  };
}

/** Collapse a current-artifact chain into a kind → content map (newest row wins per kind). */
function chainToContentMap(rows: ArtifactRow[]): Partial<Record<ArtifactKind, unknown>> {
  const map: Partial<Record<ArtifactKind, unknown>> = {};
  for (const row of rows) {
    // getChain returns newest-first; only set the first (current) occurrence per kind.
    if (!(row.kind in map)) map[row.kind] = row.content;
  }
  return map;
}

/** Sheet names ExcelJS produced (used for the `sheets` echo + the test assertions). */
function workbookSheetNames(wb: ExcelJS.Workbook): SheetNames {
  return wb.worksheets.map((ws) => ws.name);
}

/** Build a filesystem-safe descriptive filename for a rendered workbook. */
function buildFilename(which: 'A' | 'B', brandSlug: string): string {
  const label = which === 'A' ? 'BrandCoach-Mockup' : 'Marketing-Investment-Audit';
  return `${brandSlug}-${label}.xlsx`;
}

/** Slugify a brand name for a filename (alnum + dashes, never empty). */
function brandSlug(brandName: string): string {
  const slug = brandName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'IDEA';
}

/** The discriminated outcome of an export run. */
export type ExportWorkbookResult =
  | { status: 'exported'; path: string; sheets: SheetNames; missing: ArtifactKind[]; uploaded?: UploadResult }
  | { status: 'needs_input'; which: 'A' | 'B'; missing: ArtifactKind[]; note: string }
  | { status: 'failed'; note: string };

/** Input shared by the tool schema and the pure runner. */
export interface ExportWorkbookInput {
  which: 'A' | 'B';
  avatarId?: string | null;
  outDir?: string;
  brandName?: string;
  upload?: boolean;
}

/**
 * Run the export: load persisted artifacts/audit, render with the pure assembler, write the
 * .xlsx, optionally upload. Pure orchestration over the injected deps — no MCP transport, no
 * identity logic (the tool wrapper owns gateWrite), so it is unit-testable in isolation.
 */
export async function runExportWorkbook(
  input: ExportWorkbookInput,
  deps?: Partial<ExportWorkbookDeps>,
): Promise<ExportWorkbookResult> {
  const d = withDefaults(deps);
  const outDir = input.outDir ?? os.tmpdir();
  const brand = input.brandName;

  try {
    let workbook: ExcelJS.Workbook;
    let missing: ArtifactKind[] = [];

    if (input.which === 'A') {
      const chain = await d.getChain(input.avatarId ?? null);
      const contentMap = chainToContentMap(chain);
      missing = WORKBOOK_A_KINDS.filter((k) => !(k in contentMap));
      const projected = projectWorkbookAArtifacts(contentMap);
      const hasAny = Object.values(projected).some((v) => v !== undefined);
      if (!hasAny) {
        return {
          status: 'needs_input',
          which: 'A',
          missing,
          note:
            'No artifacts have been generated yet — run the diagnostic, avatar, signature, ' +
            'canvas, brief, or audit-map tools first. Workbook A renders whatever is present.',
        };
      }
      workbook = assembleWorkbookA(projected, brand ? { brandName: brand } : {});
    } else {
      const audit = await d.getCurrentMarketingAudit();
      if (!audit) {
        return {
          status: 'needs_input',
          which: 'B',
          missing: ['marketing_audit', 'rollout_plan'],
          note: 'No marketing audit has been run yet — run run_marketing_audit first.',
        };
      }
      const record: MarketingAuditRecord = { investments: audit.investments, rollout: audit.rollout };
      workbook = assembleWorkbookB(record);
    }

    const filename = buildFilename(input.which, brandSlug(brand ?? 'InfinityVault'));
    const filePath = path.join(outDir, filename);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    // Ensure the target directory exists (mkdir -p) — a nonexistent out_dir would
    // otherwise ENOENT on write (R3). Idempotent for an already-present dir.
    await d.ensureDir(outDir);
    await d.writeFile(filePath, buffer);

    let uploaded: UploadResult | undefined;
    if (input.upload) {
      uploaded = await d.uploadWorkbook(`${getIdentity().userId ?? 'anon'}/${filename}`, buffer);
    }

    return {
      status: 'exported',
      path: filePath,
      sheets: workbookSheetNames(workbook),
      missing,
      ...(uploaded ? { uploaded } : {}),
    };
  } catch (err) {
    return { status: 'failed', note: err instanceof Error ? err.message : 'export failed' };
  }
}

const inputSchema = {
  which: z.enum(['A', 'B']).describe('Which gold workbook to export: A = IDEA BrandCoach Mockup, B = Marketing Investment Audit.'),
  avatar_id: z.string().optional().describe('Avatar scope for the artifact chain (Workbook A); omit for the brand-level chain.'),
  out_dir: z.string().optional().describe('Directory to write the .xlsx into; defaults to the OS temp dir.'),
  brand_name: z.string().optional().describe('Brand name woven into Workbook A titles + the filename; defaults to InfinityVault.'),
  upload: z.boolean().default(false).describe('Also upload the file to Supabase Storage (never-fail; a missing bucket annotates the result but does not fail the export).'),
};

export function registerExportWorkbookTool(server: McpServer, deps?: Partial<ExportWorkbookDeps>): void {
  server.registerTool(
    'export_workbook',
    {
      title: 'Export a gold workbook (.xlsx)',
      description:
        'Terminal output-engine tool: render one of the two Trevor-approved gold .xlsx workbooks from the PERSISTED artifact chain and return a local file path. which:A reads the artifact chain (diagnostic/avatar/signature/canvas/brief/audit-map) and renders the BrandCoach Mockup; which:B reads the current marketing_audits row and renders the Marketing Investment Audit. Assembly reads persisted content only — it never regenerates. If the chain (A) or audit (B) is incomplete it returns needs_input listing the missing artifacts. Requires an authenticated Supabase JWT. Optional upload:true uploads the file to Supabase Storage (never-fail).',
      inputSchema,
    },
    async ({ which, avatar_id, out_dir, brand_name, upload }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const result = await runExportWorkbook({
        which,
        avatarId: avatar_id ?? null,
        outDir: out_dir,
        brandName: brand_name,
        upload,
      }, deps);

      safeLog({
        event: 'tool.export_workbook',
        caller: userTag(identity),
        which,
        status: result.status,
      });

      if (result.status === 'exported') {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Workbook ${which} exported to ${result.path} (sheets: ${result.sheets.join(', ')}).`,
            },
          ],
          structuredContent: {
            ok: true,
            path: result.path,
            sheets: result.sheets,
            missing: result.missing,
            ...(result.uploaded ? { uploaded: result.uploaded } : {}),
          },
        };
      }

      if (result.status === 'needs_input') {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Cannot export Workbook ${result.which} yet: ${result.note} (missing: ${result.missing.join(', ') || 'none'}).`,
            },
          ],
          structuredContent: { ok: false, needs_input: true, which: result.which, missing: result.missing, note: result.note },
        };
      }

      return {
        content: [{ type: 'text' as const, text: `export_workbook failed: ${result.note}` }],
        structuredContent: { ok: false, note: result.note },
        isError: true,
      };
    },
  );
}
