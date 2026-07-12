/**
 * Layer 3 (service) — Workbook A assembler.
 *
 * Turns the persisted IDEA artifact chain into the gold Workbook A .xlsx
 * (`IDEA BrandCoach InfinityVault Mockup.xlsx`). It is a PURE function over
 * already-persisted artifact CONTENT — it never regenerates, never calls an edge
 * fn, and never touches Supabase or the network. That makes it deterministic and
 * fixture-testable: the same artifact map always renders the same sheet structure.
 *
 * The gold workbook has 7 sheets. Sheets 1–2 ("How IDEA Helps IV" /
 * "Product Architecture") are static FRAMEWORK narrative with no per-user artifact
 * content, so this assembler does NOT render them — it renders the five
 * artifact-driven sheets that mirror the gold layout:
 *   - "3. Diagnostic (IV)"      ← `diagnostic_interpretation`
 *   - "4. Avatar 2.0 (IV)"      ← `avatar_s1_vocab` … `avatar_s4_objections` + `signature`
 *   - "5. Brand Canvas (IV)"    ← `brand_canvas`
 *   - "6. Export Brief"         ← `export_brief`
 *   - "7. Audit × IDEA"         ← `audit_x_idea`
 *
 * A sheet is only emitted when its backing artifact is present in the chain map;
 * missing kinds are skipped so a partial chain still produces a valid workbook of
 * whatever has been generated so far.
 *
 * Styling comes entirely from {@link ./style.ts} — section-title banner rows,
 * light-blue column-header rows, gray notes, gold column widths — so this file and
 * `assembleWorkbookB.ts` render with one shared visual vocabulary.
 */
import ExcelJS from 'exceljs';
import type { Worksheet, Row } from 'exceljs';
import type {
  ArtifactKind,
  ContractOutput,
  diagnosticInterpretationContract,
  avatarS1VocabContract,
  avatarS2JobmapContract,
  avatarS3TriggersContract,
  avatarS4ObjectionsContract,
  signatureContract,
  brandCanvasContract,
  exportBriefContract,
  auditXIdeaContract,
} from '../../contracts/index.js';
import {
  applyTitle,
  applyHeaderNote,
  applySectionTitleRow,
  applySectionNote,
  applyColumnHeaderRow,
  applyDataRow,
  applyColumnWidths,
  WORKBOOK_A_COLUMN_WIDTHS,
} from './style.js';

/** Parsed contract output types — the shape of each artifact's `content`. */
type DiagnosticContent = ContractOutput<typeof diagnosticInterpretationContract>;
type S1Content = ContractOutput<typeof avatarS1VocabContract>;
type S2Content = ContractOutput<typeof avatarS2JobmapContract>;
type S3Content = ContractOutput<typeof avatarS3TriggersContract>;
type S4Content = ContractOutput<typeof avatarS4ObjectionsContract>;
type SignatureContent = ContractOutput<typeof signatureContract>;
type CanvasContent = ContractOutput<typeof brandCanvasContract>;
type BriefContent = ContractOutput<typeof exportBriefContract>;
type AuditContent = ContractOutput<typeof auditXIdeaContract>;

/**
 * The chain map passed to the assembler: each artifact kind mapped to its parsed
 * `content` (the contract output). Built by the caller from `getChain()` — every
 * value is already contract-validated by `artifactStore`, so the assembler trusts
 * the shape and only formats it. All keys are optional: a partial chain renders
 * only the sheets it can.
 */
// TODO(competitor-agents:LT-3): brand-level competitor rollup into the gold workbooks.
// Workbook A gains a "Competitor Positioning Map" sheet — the per-touchpoint IDEA
// Trust-Gap scores from brand_asset_competitive_insights, aggregated to a brand-level
// competitor×dimension matrix (our score vs each competitor across insight/distinctive/
// empathetic/authentic). Add a `competitor_positioning?` artifact here + a SHEET_NAMES
// entry + an appendSection call, fed by a new projectWorkbookAArtifacts branch reading
// the insights chain. Workbook B's investment matrix (assembleWorkbookB) gains the
// "competitor-informed move" column sourced from brand_tests.competitor_insight_applied.
// Stays a PURE assembler — the insights read happens in exportWorkbook.ts, not here.
// See docs/brand-funnel-builder/COMPETITOR_AGENTS_LONGTERM.md §LT-3.
export interface WorkbookAArtifacts {
  diagnostic_interpretation?: DiagnosticContent;
  avatar_s1_vocab?: S1Content;
  avatar_s2_jobmap?: S2Content;
  avatar_s3_triggers?: S3Content;
  avatar_s4_objections?: S4Content;
  signature?: SignatureContent;
  brand_canvas?: CanvasContent;
  export_brief?: BriefContent;
  audit_x_idea?: AuditContent;
}

/** Options for {@link assembleWorkbookA}. */
export interface AssembleWorkbookAOptions {
  /**
   * Brand/company name woven into sheet titles in place of the gold's hard-coded
   * "InfinityVault". Defaults to the gold brand so the fixture diff is exact.
   */
  brandName?: string;
}

/** Gold sheet names, in render order (the artifact-driven subset of the 7). */
const SHEET_NAMES = {
  diagnostic: '3. Diagnostic (IV)',
  avatar: '4. Avatar 2.0 (IV)',
  canvas: '5. Brand Canvas (IV)',
  brief: '6. Export Brief',
  audit: '7. Audit × IDEA',
} as const;

/** The default brand name (matches the committed gold fixture). */
const DEFAULT_BRAND_NAME = 'InfinityVault';

/**
 * Append a styled section block: a navy banner row (the section name), an optional
 * gray note row, a light-blue column-header row, then one styled data row per record.
 * Returns nothing — it mutates the worksheet in place (the ExcelJS idiom).
 */
function appendTable(
  sheet: Worksheet,
  spec: {
    sectionTitle: string;
    note?: string | null;
    columns: readonly string[];
    rows: readonly (readonly string[])[];
  },
): void {
  const banner = sheet.addRow([spec.sectionTitle]);
  applySectionTitleRow(banner);

  if (spec.note) {
    const noteRow = sheet.addRow([spec.note]);
    applySectionNote(noteRow.getCell(1));
  }

  const headerRow = sheet.addRow([...spec.columns]);
  applyColumnHeaderRow(headerRow);

  for (const record of spec.rows) {
    const dataRow = sheet.addRow([...record]);
    applyDataRow(dataRow);
  }

  // One blank spacer row between blocks (matches the gold's visual rhythm).
  sheet.addRow([]);
}

/** Append the sheet title + header-note caption rows shared by every sheet. */
function appendSheetHeader(sheet: Worksheet, title: string, headerNote: string): void {
  const titleRow = sheet.addRow([title]);
  applyTitle(titleRow.getCell(1));
  const noteRow = sheet.addRow([headerNote]);
  applyHeaderNote(noteRow.getCell(1));
  sheet.addRow([]);
}

// ---------------------------------------------------------------------------
// Sheet 3 — Diagnostic
// ---------------------------------------------------------------------------
function buildDiagnosticSheet(wb: ExcelJS.Workbook, content: DiagnosticContent, brandName: string): void {
  const sheet = wb.addWorksheet(SHEET_NAMES.diagnostic);
  applyColumnWidths(sheet, WORKBOOK_A_COLUMN_WIDTHS);
  appendSheetHeader(
    sheet,
    `Trust Gap™ Diagnostic — ${brandName}`,
    'Generated from intake + evidence (reviews, listing copy). Residual inference labeled per the grounding flag.',
  );

  // Overall score header band (gold sheet-3 first table).
  appendTable(sheet, {
    sectionTitle: 'Overall Trust Gap™ Score',
    columns: ['Overall Trust Gap™ Score', 'Primary gap'],
    rows: [[`${content.overall_score} / 100`, `Primary gap: ${content.primary_gap}`]],
  });

  // The four dimensions grid.
  appendTable(sheet, {
    sectionTitle: 'The four dimensions',
    note: content.interpretation,
    columns: ['Dimension', 'Score / 25', 'What it measures', `${brandName} read`, 'Where it shows up'],
    rows: content.dimensions.map((d) => [
      d.dimension,
      `${d.score} / 25`,
      d.what_it_measures,
      d.brand_read,
      d.where_it_shows_up,
    ]),
  });

  // Triage recommendation prose.
  appendTable(sheet, {
    sectionTitle: 'What the Diagnostic recommends next',
    note: content.recommendation_rationale,
    columns: ['Recommended next module'],
    rows: [[content.recommended_next_module]],
  });
}

// ---------------------------------------------------------------------------
// Sheet 4 — Avatar 2.0 (S1–S4 blocks + Signature)
// ---------------------------------------------------------------------------
function buildAvatarSheet(
  wb: ExcelJS.Workbook,
  artifacts: WorkbookAArtifacts,
  brandName: string,
): void {
  const sheet = wb.addWorksheet(SHEET_NAMES.avatar);
  applyColumnWidths(sheet, WORKBOOK_A_COLUMN_WIDTHS);
  appendSheetHeader(
    sheet,
    `Avatar 2.0™ — ${brandName} (worked example)`,
    'The 5 research stages. Every cell traces to forensic review analysis (grounding flag records evidence vs inference).',
  );

  if (artifacts.avatar_s1_vocab) {
    appendTable(sheet, {
      sectionTitle: 'Stage 1 — Vocabulary Forensics',
      note: 'Extracts unprompted customer language, ranks by frequency, clusters by emotion. The raw evidence everything else is built from.',
      columns: ['Cluster', 'Customer words (unprompted)', 'Frequency signal', 'Why it matters'],
      rows: artifacts.avatar_s1_vocab.clusters.map((c) => [
        c.cluster,
        c.customer_words.join(', '),
        c.frequency_signal,
        c.why_it_matters,
      ]),
    });
  }

  if (artifacts.avatar_s2_jobmap) {
    appendTable(sheet, {
      sectionTitle: 'Stage 2 — Functional vs Emotional Job Map',
      note: 'Separates what the product DOES from what the customer feels when it works.',
      columns: ['Functional job', 'Emotional job', 'Identity job', 'Villain (the failure state avoided)'],
      rows: artifacts.avatar_s2_jobmap.job_map.map((j) => [
        j.functional_job,
        j.emotional_job,
        j.identity_job,
        j.villain,
      ]),
    });
  }

  if (artifacts.avatar_s3_triggers) {
    appendTable(sheet, {
      sectionTitle: 'Stage 3 — The Decision Trigger™',
      note: 'The specific moments that turn passive interest into a search. Estimated volume is a labeled band, never a fabricated number.',
      columns: ['Trigger moment', 'What they feel', 'What they search', 'Estimated volume'],
      rows: artifacts.avatar_s3_triggers.triggers.map((t) => [
        t.trigger_moment,
        t.what_they_feel,
        t.search_terms.join(', '),
        t.estimated_volume_band,
      ]),
    });
  }

  if (artifacts.avatar_s4_objections) {
    appendTable(sheet, {
      sectionTitle: 'Stage 4 — Hesitations & Objections (what’s stopping the purchase)',
      columns: ['Hesitation', 'Verbatim signal', 'What resolves it in copy / image / A+'],
      rows: artifacts.avatar_s4_objections.objections.map((o) => [
        o.hesitation,
        o.verbatim_signal,
        o.resolution,
      ]),
    });
  }

  if (artifacts.signature) {
    const sig = artifacts.signature;
    appendTable(sheet, {
      sectionTitle: 'Stage 5 — The Signature (the retention moment)',
      note: 'Synthesises everything above into one sentence. The user picks the version that lands hardest.',
      columns: ['Option', 'Signature', 'Chosen'],
      rows: sig.options.map((opt) => [
        `Option ${opt.option}`,
        opt.sentence,
        sig.chosen_option === opt.option ? '✓ chosen' : '',
      ]),
    });
  }
}

// ---------------------------------------------------------------------------
// Sheet 5 — Brand Canvas
// ---------------------------------------------------------------------------
function buildCanvasSheet(wb: ExcelJS.Workbook, content: CanvasContent, brandName: string): void {
  const sheet = wb.addWorksheet(SHEET_NAMES.canvas);
  applyColumnWidths(sheet, WORKBOOK_A_COLUMN_WIDTHS);
  appendSheetHeader(
    sheet,
    `Brand Canvas — ${brandName}`,
    'The one-page document generated from Avatar 2.0. The source of truth for every piece of content downstream.',
  );

  // The Signature line as a banner-with-note (mirrors the gold canvas top block).
  appendTable(sheet, {
    sectionTitle: 'The Signature',
    note: content.signature,
    columns: ['Category', 'Voice attributes'],
    rows: [[content.positioning.category, content.voice.voice_attributes]],
  });

  // Positioning × Voice interleaved grid — one row per positioning field, paired
  // left-to-right with its voice counterpart (mirrors the gold 2-pane layout).
  const pos = content.positioning;
  const voice = content.voice;
  appendTable(sheet, {
    sectionTitle: 'Positioning',
    columns: ['Positioning element', 'Value', 'Voice element', 'Value'],
    rows: [
      ['Position', pos.position, 'Tone do’s', voice.tone_dos],
      ['Promise', pos.promise, 'Tone don’ts', voice.tone_donts],
      ['Villain', pos.villain, 'Words we use', voice.words_we_use.join(', ')],
      ['Identity payoff', pos.identity_payoff, 'Words we don’t', voice.words_we_dont.join(', ')],
    ],
  });

  // Brand story spine prose block. The spine text renders ONCE — as the labeled data
  // row under the "Story spine" header. (Previously it was passed BOTH as `note` and as
  // the data row, rendering the same paragraph twice — the gold rows 16/17→18/19 dupe.)
  appendTable(sheet, {
    sectionTitle: 'Brand story spine (for A+ content, About section, ad lead-ins)',
    columns: ['Story spine'],
    rows: [[content.story_spine]],
  });
}

// ---------------------------------------------------------------------------
// Sheet 6 — Export Brief
// ---------------------------------------------------------------------------
function buildBriefSheet(wb: ExcelJS.Workbook, content: BriefContent, brandName: string): void {
  const sheet = wb.addWorksheet(SHEET_NAMES.brief);
  applyColumnWidths(sheet, WORKBOOK_A_COLUMN_WIDTHS);
  appendSheetHeader(
    sheet,
    'The Export Brief — what feeds Pixii, Helium 10, Claude, freelancers',
    'The actual leverage point. The brief that makes any execution tool produce on-brand work.',
  );

  // Listing Copy Brief: title formula row + the 5 bullets (Element/Brief/Example output).
  const listingRows: string[][] = [
    ['TITLE FORMULA', content.title_formula.brief, content.title_formula.example_output],
    ...content.bullets.map((b) => [b.element, b.brief, b.example_output]),
  ];
  appendTable(sheet, {
    sectionTitle: `Listing Copy Brief — ${brandName} (auto-generated from Brand Canvas)`,
    columns: ['Element', 'Brief', 'Example output'],
    rows: listingRows,
  });

  // Image Brief: 7 slots.
  appendTable(sheet, {
    sectionTitle: 'Image Brief — what to take into Pixii (or a photographer)',
    columns: ['Slot', 'Intent', 'Brief'],
    rows: content.image_brief.map((s) => [s.slot, s.intent, s.brief]),
  });

  // PPC Keyword Brief: tier A/B/C, one row per tier (keywords joined).
  appendTable(sheet, {
    sectionTitle: 'PPC Keyword Brief — bidding against Decision Triggers, not category',
    columns: ['Tier', 'Keywords'],
    rows: [
      ['TIER A — Trigger-state (highest intent, lowest competition)', content.ppc_keywords.tier_a.join(', ')],
      ['TIER B — Identity-state (medium intent, medium competition)', content.ppc_keywords.tier_b.join(', ')],
      ['TIER C — Category (high competition, defensive only)', content.ppc_keywords.tier_c.join(', ')],
    ],
  });
}

// ---------------------------------------------------------------------------
// Sheet 7 — Audit × IDEA
// ---------------------------------------------------------------------------
function buildAuditSheet(wb: ExcelJS.Workbook, content: AuditContent): void {
  const sheet = wb.addWorksheet(SHEET_NAMES.audit);
  applyColumnWidths(sheet, WORKBOOK_A_COLUMN_WIDTHS);
  appendSheetHeader(
    sheet,
    'How IDEA outputs upgrade every move in the marketing audit',
    'The two workbooks compound. This sheet maps the lift per investment when IDEA inputs feed it.',
  );

  appendTable(sheet, {
    sectionTitle: 'Lift per investment',
    columns: ['Audit investment', 'Without IDEA', 'With IDEA inputs', 'Estimated lift multiplier'],
    rows: content.rows.map((r) => [r.audit_investment, r.without_idea, r.with_idea, r.estimated_lift]),
  });
}

/**
 * Assemble Workbook A from the persisted artifact chain.
 *
 * Pure over `artifacts` — renders one sheet per present artifact kind, in gold
 * sheet order (Diagnostic → Avatar 2.0 → Canvas → Brief → Audit × IDEA). A kind
 * absent from the map is silently skipped, so a partial chain yields a partial but
 * valid workbook. No regeneration, no LLM, no I/O.
 *
 * @param artifacts parsed artifact content keyed by kind (built from `getChain()`).
 * @param opts      optional brand name woven into titles (defaults to the gold brand).
 * @returns an in-memory ExcelJS workbook ready for `xlsx.writeFile`/`writeBuffer`.
 */
export function assembleWorkbookA(
  artifacts: WorkbookAArtifacts,
  opts: AssembleWorkbookAOptions = {},
): ExcelJS.Workbook {
  const brandName = opts.brandName ?? DEFAULT_BRAND_NAME;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IDEA Brand Coach';
  wb.created = new Date(0); // deterministic timestamp so fixture renders are byte-stable
  wb.modified = new Date(0); // pin modified too — ExcelJS embeds dcterms:modified into core.xml; unpinned it defaults to wall-clock and breaks byte-determinism

  if (artifacts.diagnostic_interpretation) {
    buildDiagnosticSheet(wb, artifacts.diagnostic_interpretation, brandName);
  }

  // The avatar sheet renders whenever ANY of its stage artifacts is present.
  const hasAvatar =
    artifacts.avatar_s1_vocab ||
    artifacts.avatar_s2_jobmap ||
    artifacts.avatar_s3_triggers ||
    artifacts.avatar_s4_objections ||
    artifacts.signature;
  if (hasAvatar) {
    buildAvatarSheet(wb, artifacts, brandName);
  }

  if (artifacts.brand_canvas) {
    buildCanvasSheet(wb, artifacts.brand_canvas, brandName);
  }
  if (artifacts.export_brief) {
    buildBriefSheet(wb, artifacts.export_brief, brandName);
  }
  if (artifacts.audit_x_idea) {
    buildAuditSheet(wb, artifacts.audit_x_idea);
  }

  return wb;
}

/**
 * Convenience: project an `artifacts`-table chain (kind → content) into the typed
 * {@link WorkbookAArtifacts} map the assembler expects. The export_workbook tool
 * (later phase) builds the source map from `getChain()`; this keeps the projection
 * in one place. Values are passed through untouched (already contract-validated on
 * write), so this only narrows keys to the Workbook A subset.
 */
export function projectWorkbookAArtifacts(
  chain: Partial<Record<ArtifactKind, unknown>>,
): WorkbookAArtifacts {
  return {
    diagnostic_interpretation: chain.diagnostic_interpretation as DiagnosticContent | undefined,
    avatar_s1_vocab: chain.avatar_s1_vocab as S1Content | undefined,
    avatar_s2_jobmap: chain.avatar_s2_jobmap as S2Content | undefined,
    avatar_s3_triggers: chain.avatar_s3_triggers as S3Content | undefined,
    avatar_s4_objections: chain.avatar_s4_objections as S4Content | undefined,
    signature: chain.signature as SignatureContent | undefined,
    brand_canvas: chain.brand_canvas as CanvasContent | undefined,
    export_brief: chain.export_brief as BriefContent | undefined,
    audit_x_idea: chain.audit_x_idea as AuditContent | undefined,
  };
}
