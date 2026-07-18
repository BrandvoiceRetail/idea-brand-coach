/**
 * Layer 2 (tool) — `export_messaging_workbook` (OWNED, WRITE, gateWrite — multi-avatar set).
 *
 * The SET counterpart to `export_workbook`: it renders the multi-avatar messaging-perception
 * workbook — for ONE planned strategic message, how EACH selected avatar perceives it, judged
 * ONLY from that avatar's real Avatar 2.0 forensics, rolled up to a weakest-link set verdict.
 *
 * Unlike `export_workbook` (pure read → render over an already-complete chain), this tool DOES
 * the AI + persistence so the assembler can stay pure: for each avatar it reads the persisted
 * S1–S4 forensics (`getChain`), resolves the ONE message (the `message` param, else the set's
 * Positioning Statement `chosen_option` sentence), reuses an existing `messaging_perception` artifact when
 * one is already on file FOR THIS MESSAGE, and otherwise INVOKES the `analyze-message-perception`
 * edge fn (the perception engine, auth + credit-gated) and PERSISTS the validated content as a
 * fresh `messaging_perception` artifact (avatar-scoped). Then it calls the PURE assembler
 * (`assembleMessagingPerceptionWorkbook`) over the collected set and writes the .xlsx.
 *
 * NO FABRICATION: an avatar with no forensics at all is NEVER skipped — it is persisted/emitted
 * as a canonical `analysable:false` perception (`notAnalysablePerception`) WITHOUT a model call
 * or metering, and still appears in the workbook as an honest "not yet analysable" (an unknown,
 * never a guessed pass). The edge fn enforces the same no-fabrication bar server-side, so its
 * output always satisfies the Phase-1 contract.
 *
 * IDENTITY: gateWrite() denies anonymous callers, and requireOwnedAvatar gates EVERY avatar_id
 * before any work (a foreign/absent member is an explicit refusal, not a silent brand-level
 * write). Single-avatar correctness holds: a 1-id set renders a valid workbook. The optional
 * Storage upload is never-fail (the local file is the deliverable), reusing `export_workbook`'s
 * `uploadWorkbook`.
 */
import os from 'node:os';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type ExcelJS from 'exceljs';
import { assembleMessagingPerceptionWorkbook } from '../service/workbook/assembleMessagingPerceptionWorkbook.js';
import {
  getChain as getChainLive,
  getCurrentArtifact as getCurrentArtifactLive,
  saveArtifact as saveArtifactLive,
  type ArtifactRow,
} from '../service/artifactStore.js';
import { getAvatar as getAvatarLive } from '../service/avatarLifecycle.js';
import { EdgeFnClient } from '../edgeFn/client.js';
import {
  positioningStatementOutputSchema,
  safeParseMessagingPerception,
  notAnalysablePerception,
  weakestVerdict,
  type ArtifactKind,
  type MessagingPerceptionContent,
  type MessagingVerdict,
} from '../contracts/index.js';
import { uploadWorkbook, type UploadResult } from './exportWorkbook.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatarSet } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { captureMcpEvent } from '../posthog.js';
import { getIdentity, userTag } from '../context/identity.js';

/** The forensic artifact kinds judged against each perception dimension (S1→S4). */
const FORENSIC_KINDS = {
  s1_vocab: 'avatar_s1_vocab',
  s2_jobmap: 'avatar_s2_jobmap',
  s3_triggers: 'avatar_s3_triggers',
  s4_objections: 'avatar_s4_objections',
} as const satisfies Record<string, ArtifactKind>;

const POSITIONING_STATEMENT_KIND: ArtifactKind = 'positioning_statement';
const PERCEPTION_KIND: ArtifactKind = 'messaging_perception';

/** Injectable collaborators (default to the live module fns) so the tool is unit-testable. */
export interface ExportMessagingWorkbookDeps {
  getChain: typeof getChainLive;
  getCurrentArtifact: typeof getCurrentArtifactLive;
  saveArtifact: typeof saveArtifactLive;
  getAvatar: typeof getAvatarLive;
  /** Edge-fn transport for the perception engine (forwards the bound JWT). */
  edgeFn: EdgeFnClient;
  uploadWorkbook: typeof uploadWorkbook;
  /** Ensure the out dir exists before writing (recursive mkdir -p); injectable for tests. */
  ensureDir: (dirPath: string) => Promise<void>;
  /** Buffer → disk; injectable so tests assert the round-trip without real fs writes. */
  writeFile: (filePath: string, buffer: Buffer) => Promise<void>;
}

function withDefaults(deps?: Partial<ExportMessagingWorkbookDeps>): ExportMessagingWorkbookDeps {
  return {
    getChain: deps?.getChain ?? getChainLive,
    getCurrentArtifact: deps?.getCurrentArtifact ?? getCurrentArtifactLive,
    saveArtifact: deps?.saveArtifact ?? saveArtifactLive,
    getAvatar: deps?.getAvatar ?? getAvatarLive,
    edgeFn: deps?.edgeFn ?? new EdgeFnClient(),
    uploadWorkbook: deps?.uploadWorkbook ?? uploadWorkbook,
    ensureDir: deps?.ensureDir ?? (async (dirPath) => { await mkdir(dirPath, { recursive: true }); }),
    writeFile: deps?.writeFile ?? ((filePath, buffer) => writeFile(filePath, buffer)),
  };
}

/** The current (non-superseded) content of a kind in an avatar's chain, or `undefined`. */
function pickContent(chain: ArtifactRow[], kind: ArtifactKind): unknown | undefined {
  // getChain returns only current rows (superseded_by IS NULL), newest first → one per kind.
  return chain.find((row) => row.kind === kind)?.content;
}

/**
 * The chosen Positioning Statement sentence from a persisted `positioning_statement` artifact, or `null`. Prefers the
 * `chosen_option` the user picked; falls back to the first option when none is chosen yet.
 */
function positioningStatementSentence(content: unknown): string | null {
  const parsed = positioningStatementOutputSchema.safeParse(content);
  if (!parsed.success) return null;
  const sig = parsed.data;
  const chosen = sig.chosen_option != null ? sig.options.find((o) => o.option === sig.chosen_option) : undefined;
  return (chosen ?? sig.options[0]).sentence;
}

/** Build a filesystem-safe descriptive filename for the rendered workbook. */
function buildFilename(brandSlug: string): string {
  return `${brandSlug}-Messaging-Perception.xlsx`;
}

/** Slugify a brand name for a filename (alnum + dashes, never empty). */
function brandSlug(brandName: string): string {
  const slug = brandName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'IDEA';
}

/** The discriminated outcome of an export run. */
export type ExportMessagingWorkbookResult =
  | { status: 'exported'; path: string; avatars: number; weakest: MessagingVerdict | null; sheets: string[]; uploaded?: UploadResult }
  | { status: 'needs_input'; note: string }
  | { status: 'failed'; note: string };

/** Input shared by the tool schema and the pure runner. */
export interface ExportMessagingWorkbookInput {
  avatarIds: string[];
  message?: string;
  outDir?: string;
  brandName?: string;
  upload?: boolean;
}

/**
 * Resolve, judge (or reuse), persist, and render. The tool owns the AI + persistence so the
 * assembler stays pure; identity/ownership gating lives in the tool wrapper. Pure orchestration
 * over the injected deps — no MCP transport — so it is unit-testable in isolation.
 */
export async function runExportMessagingWorkbook(
  input: ExportMessagingWorkbookInput,
  deps?: Partial<ExportMessagingWorkbookDeps>,
): Promise<ExportMessagingWorkbookResult> {
  const d = withDefaults(deps);
  const outDir = input.outDir ?? os.tmpdir();
  const brand = input.brandName;

  try {
    // 1. Read each avatar's persisted forensic chain + resolved name (once per avatar).
    const chainByAvatar = new Map<string, ArtifactRow[]>();
    const nameByAvatar = new Map<string, string>();
    for (const id of input.avatarIds) {
      chainByAvatar.set(id, await d.getChain(id));
      const avatar = await d.getAvatar(id);
      nameByAvatar.set(id, avatar?.name ?? 'Avatar');
    }

    // 2. Resolve the ONE planned message: the param, else the set's Positioning Statement sentence.
    let message = input.message?.trim() ?? '';
    if (!message) {
      for (const id of input.avatarIds) {
        const sentence = positioningStatementSentence(pickContent(chainByAvatar.get(id) ?? [], POSITIONING_STATEMENT_KIND));
        if (sentence) {
          message = sentence;
          break;
        }
      }
    }
    if (!message) {
      return {
        status: 'needs_input',
        note:
          'No planned message provided and no Positioning Statement on file for the set — pass `message` ' +
          '(the one strategic line to test), or generate and persist a Positioning Statement first ' +
          '(generate_positioning_statement → persist_positioning_statement).',
      };
    }

    // 3. One MessagingPerceptionContent per avatar — reuse, judge, or honest not-analysable.
    const perceptions: MessagingPerceptionContent[] = [];
    for (const id of input.avatarIds) {
      const chain = chainByAvatar.get(id) ?? [];
      const avatarName = nameByAvatar.get(id) ?? 'Avatar';

      // Reuse an existing perception ONLY when it was judged for THIS exact message.
      const existing = await d.getCurrentArtifact(PERCEPTION_KIND, id);
      if (existing) {
        const parsed = safeParseMessagingPerception(existing.content);
        if (parsed.success && parsed.data.message === message) {
          perceptions.push(parsed.data);
          continue;
        }
      }

      const forensics = {
        s1_vocab: pickContent(chain, FORENSIC_KINDS.s1_vocab),
        s2_jobmap: pickContent(chain, FORENSIC_KINDS.s2_jobmap),
        s3_triggers: pickContent(chain, FORENSIC_KINDS.s3_triggers),
        s4_objections: pickContent(chain, FORENSIC_KINDS.s4_objections),
      };
      const hasAnyForensic = Object.values(forensics).some((v) => v !== undefined);

      let content: MessagingPerceptionContent;
      if (!hasAnyForensic) {
        // No Avatar 2.0 at all → honest "not yet analysable" (no model call, no metering).
        content = notAnalysablePerception({ avatar_id: id, avatar_name: avatarName, message });
      } else {
        const res = await d.edgeFn.invoke<unknown>('analyze-message-perception', {
          avatar_id: id,
          avatar_name: avatarName,
          message,
          forensics,
        });
        if (!res.ok || res.data == null) {
          return { status: 'failed', note: res.note ?? 'the message-perception engine returned nothing' };
        }
        const parsed = safeParseMessagingPerception(res.data);
        if (!parsed.success) {
          return { status: 'failed', note: `message-perception output failed the contract: ${parsed.error.message}` };
        }
        content = parsed.data;
      }

      // Persist the perception as an avatar-scoped artifact (grounding is held INLINE in the
      // content; the row's grounding column is 'inference' — a perception is inferred, and
      // 'inference' carries no evidence_refs requirement).
      await d.saveArtifact(PERCEPTION_KIND, content, { grounding: 'inference', evidenceRefs: [], avatarId: id });
      perceptions.push(content);
    }

    // 4. Render with the PURE assembler (no regeneration here).
    const workbook: ExcelJS.Workbook = assembleMessagingPerceptionWorkbook(
      perceptions,
      brand ? { brandName: brand } : {},
    );

    // 5. Write the .xlsx (mkdir -p the out dir so a nonexistent dir does not ENOENT).
    const filename = buildFilename(brandSlug(brand ?? 'InfinityVault'));
    const filePath = path.join(outDir, filename);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    await d.ensureDir(outDir);
    await d.writeFile(filePath, buffer);

    // 6. Optional never-fail upload (mirrors export_workbook).
    let uploaded: UploadResult | undefined;
    if (input.upload) {
      uploaded = await d.uploadWorkbook(`${getIdentity().userId ?? 'anon'}/${filename}`, buffer);
    }

    const analysable = perceptions.filter((p) => p.analysable);
    const weakest = analysable.length ? weakestVerdict(analysable.map((p) => p.overall_verdict)) : null;

    return {
      status: 'exported',
      path: filePath,
      avatars: perceptions.length,
      weakest,
      sheets: workbook.worksheets.map((ws) => ws.name),
      ...(uploaded ? { uploaded } : {}),
    };
  } catch (err) {
    return { status: 'failed', note: err instanceof Error ? err.message : 'export failed' };
  }
}

const inputSchema = {
  avatar_ids: z
    .array(z.string())
    .min(1)
    .describe('The active avatar SET to read the message through — every avatar is judged + appears in the workbook (a 1-id set is valid).'),
  message: z
    .string()
    .optional()
    .describe('The ONE planned strategic message to test across the set. If omitted, the set Positioning Statement (chosen option) is used.'),
  out_dir: z.string().optional().describe('Directory to write the .xlsx into; defaults to the OS temp dir.'),
  brand_name: z.string().optional().describe('Brand name woven into the workbook titles + the filename; defaults to InfinityVault.'),
  upload: z.boolean().default(false).describe('Also upload the file to Supabase Storage (never-fail; a missing bucket annotates the result but does not fail the export).'),
};

export function registerExportMessagingWorkbookTool(server: McpServer, deps?: Partial<ExportMessagingWorkbookDeps>): void {
  server.registerTool(
    'export_messaging_workbook',
    {
      title: 'Export the multi-avatar messaging workbook (.xlsx)',
      description:
        'Render the multi-avatar messaging-perception workbook: for ONE planned message, how each selected avatar perceives it across the four IDEA dimensions (vocabulary / jobs / trigger / objections), judged ONLY from that avatar\'s own Avatar 2.0 forensics, rolled up to a weakest-link set verdict. Pass avatar_ids (the active set) and optionally the message (else the set Positioning Statement is used). For each avatar it reuses an on-file perception for this message, else derives one via the perception engine and persists it; an avatar with no forensics appears honestly as "not yet analysable", never a guessed score. Requires an authenticated Supabase JWT; every avatar_id must be owned. Optional upload:true uploads the file to Supabase Storage (never-fail).',
      inputSchema,
    },
    async ({ avatar_ids, message, out_dir, brand_name, upload }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      // Gate the WHOLE set atomically: every avatar owned AND all in ONE brand (a
      // messaging workbook must never mix brands — defense-in-depth over RLS).
      const { denied: setDenied } = await requireOwnedAvatarSet(avatar_ids);
      if (setDenied) return setDenied;

      const result = await runExportMessagingWorkbook({
        avatarIds: avatar_ids,
        message,
        outDir: out_dir,
        brandName: brand_name,
        upload,
      }, deps);

      safeLog({
        event: 'tool.export_messaging_workbook',
        caller: userTag(identity),
        avatars: avatar_ids.length,
        status: result.status,
      });

      if (result.status === 'exported') {
        captureMcpEvent(identity.userId as string, 'mcp_messaging_workbook_exported', {
          avatars: result.avatars,
          weakest: result.weakest ?? 'none',
          sheet_count: result.sheets.length,
          uploaded: !!result.uploaded,
        });
        const summary = `${result.avatars} avatar(s), set verdict: ${result.weakest ?? 'not yet analysable'}; sheets: ${result.sheets.join(', ')}`;
        const downloadUrl = result.uploaded?.signedUrl ?? null;
        return {
          content: [
            {
              type: 'text' as const,
              text: downloadUrl
                ? `Your messaging-perception workbook is ready (${summary}).\n\n**Download it here** (link valid 7 days): ${downloadUrl}`
                : `Your messaging-perception workbook was generated (${summary}), but a download link could not be created${result.uploaded?.note ? ` — ${result.uploaded.note}` : ' (upload was not requested)'}. Ask me to export it again with upload enabled.`,
            },
          ],
          structuredContent: {
            ok: true,
            path: result.path,
            download_url: downloadUrl,
            avatars: result.avatars,
            weakest: result.weakest,
            ...(result.uploaded ? { uploaded: result.uploaded } : {}),
          },
        };
      }

      if (result.status === 'needs_input') {
        captureMcpEvent(identity.userId as string, 'mcp_messaging_workbook_needs_input', {});
        return {
          content: [{ type: 'text' as const, text: `Cannot export the messaging workbook yet: ${result.note}` }],
          structuredContent: { ok: false, needs_input: true, note: result.note },
        };
      }

      captureMcpEvent(identity.userId as string, 'mcp_messaging_workbook_failed', {});
      return {
        content: [{ type: 'text' as const, text: `export_messaging_workbook failed: ${result.note}` }],
        structuredContent: { ok: false, note: result.note },
        isError: true,
      };
    },
  );
}
