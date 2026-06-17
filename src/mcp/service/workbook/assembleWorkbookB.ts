/**
 * Layer 3 (service) — assemble gold Workbook B (`InfinityVault Marketing Investment
 * Audit.xlsx`) from a persisted `marketing_audits` row.
 *
 * Phase 6 of the output engine: **assembly reads persisted artifacts only — it never
 * regenerates content.** The deterministic numbers + prose were already produced and
 * persisted by `run_marketing_audit` (Phase 5); this module is a pure, fixture-testable
 * renderer over that stored data, so two exports of the same audit are byte-identical.
 *
 * The gold workbook has two sheets, each reverse-engineered into JSON at
 * `src/mcp/__tests__/fixtures/workbook-b.json`:
 *
 *   1. "Investment Matrix" — title, self-flagging header note, the tiered Investment
 *      Matrix table (11 columns, one color-banded row per move), a Tier legend block,
 *      and a "Notes on benefit estimates" block.
 *   2. "Recommended Phasing" — title, header note, the 4-phase rollout table (5 columns),
 *      the cumulative-impact estimate grid (5 columns), and a Caveats block.
 *
 * The matrix rows + phase rows + cumulative-impact rows come from the persisted audit
 * (`investments` / `rollout` jsonb). The legend / notes / caveats prose is static gold
 * FRAMEWORK copy (manifest §1 FRAMEWORK class) that is identical for every user, so it
 * lives here as constants rather than in per-user storage — it carries no calibrated
 * number and no fabrication-gated claim.
 *
 * Pure: nothing here touches Supabase, the network, or identity. Callers pass the already
 * read-back `marketing_audits` row; the tool layer (export_workbook, a later phase) owns
 * the DB read and the file write.
 */
import ExcelJS from 'exceljs';
import type { Worksheet } from 'exceljs';
import {
  marketingAuditOutputSchema,
  rolloutPlanOutputSchema,
  type MarketingAuditOutput,
  type RolloutPlanOutput,
  type InvestmentRow,
  type RolloutPhase,
  type CumulativeImpactRow,
} from '../../contracts/index.js';
import {
  applyTitle,
  applyHeaderNote,
  applyColumnHeaderRow,
  applySectionTitleRow,
  applySectionNote,
  applyDataRow,
  applyColumnWidths,
  WORKBOOK_B_COLUMN_WIDTHS,
} from './style.js';

/**
 * The persisted `marketing_audits` row shape this assembler consumes. Mirrors the row
 * `run_marketing_audit` writes (`saveMarketingAudit`): `investments` is the validated
 * `marketing_audit` artifact and `rollout` is the validated `rollout_plan` artifact, both
 * stored as jsonb. Typed `unknown` here because they come back from the DB untyped; the
 * assembler re-validates them through the Phase-0 contracts before rendering.
 */
export interface MarketingAuditRecord {
  /** "Investment Matrix" rows — a {@link MarketingAuditOutput} as persisted jsonb. */
  investments: unknown;
  /** "Recommended Phasing" — a {@link RolloutPlanOutput} as persisted jsonb. */
  rollout: unknown;
}

/** Gold sheet names, verbatim from the workbook. */
export const WORKBOOK_B_SHEET_NAMES = ['Investment Matrix', 'Recommended Phasing'] as const;

/** Gold "Investment Matrix" column headers, verbatim + in order. */
export const INVESTMENT_MATRIX_COLUMNS = [
  'Tier',
  'Investment',
  'What it is',
  'Calendar time',
  'Person-hours',
  'Level of effort',
  'Cash cost',
  '1-mo benefit',
  '3-mo benefit',
  '6-mo benefit',
  '12-mo benefit',
] as const;

/** Gold "Recommended Phasing" phase-table column headers, verbatim + in order. */
export const PHASING_COLUMNS = ['Phase', 'Window', 'Action', 'Cash needed', 'Why now'] as const;

/** Gold cumulative-impact grid column headers, verbatim + in order. */
export const CUMULATIVE_IMPACT_COLUMNS = [
  'Horizon',
  'Low estimate',
  'Mid estimate',
  'High estimate',
  'Notes',
] as const;

/** Gold sheet titles + self-flagging header notes (FRAMEWORK prose, verbatim). */
const INVESTMENT_MATRIX_TITLE = 'InfinityVault — Advertising & Marketing Investment Audit';
const INVESTMENT_MATRIX_HEADER_NOTE =
  'Scored against current constraints: tight cash, thin margins, ~$1K/mo Uncapped repayment starting June, May inventory order priority.';
const PHASING_TITLE = 'Recommended 90-Day Rollout';
const PHASING_HEADER_NOTE =
  'Sequenced for cash flow (May inventory first, June Uncapped payments begin) — front-loads free/high-ROI moves.';

/**
 * The "Tier legend" block — static gold FRAMEWORK copy. Each entry is [tier, meaning];
 * gold renders these as a two-column key under the matrix.
 */
const TIER_LEGEND: ReadonlyArray<readonly [string, string]> = [
  ['T1', "Do first — free/near-free, immediate ROI, no cash strain. Most of these are leverage moves you can't NOT do."],
  ['T2', 'Queue for after May inventory order + once Uncapped plan is signed. Small cash, real lift.'],
  ['T3', 'Defer until base is profitable. Higher effort, slower payoff, or requires upstream foundation (email, brand registry assets, etc.).'],
] as const;

/** "Notes on benefit estimates" block — static gold FRAMEWORK caveat prose, verbatim. */
const BENEFIT_NOTES: readonly string[] = [
  '• Benefits are revenue lift estimates, not profit. Apply your ~10% post-ad margin target to estimate profit impact.',
  '• Ranges reflect uncertainty — pick the low end if conservative, midpoint for planning.',
  '• Benefits are NOT additive across all rows — they overlap (e.g., A+ content + photography both lift conversion on the same listing).',
  '• 12-month figures assume the work is maintained, not one-and-done.',
  '• Estimates are calibrated to your business size from prior conversations — adjust if revenue is materially different than assumed.',
] as const;

/** "Caveats" block on the phasing sheet — static gold FRAMEWORK prose, verbatim. */
const PHASING_CAVEATS: readonly string[] = [
  '• Estimates assume disciplined execution + maintenance. Skipping any one Tier 1 item materially lowers the range.',
  '• Numbers reflect REVENUE lift, not profit. Apply your post-ad margin target (~10%) to get profit impact.',
  "• Doesn't account for inventory replenishment cash needs — coordinate with cash flow plan.",
  '• Diamond Grain 216 (high stock) is the leverage SKU — most of the lift will flow through it.',
  '• If Vintage 216 stays out of AWD, the price-anchor strategy weakens and Tier 1 estimates compress.',
] as const;

/** Section-title labels, verbatim from gold (used as the table `name` banners). */
const TIER_LEGEND_TITLE = 'Tier legend:';
const BENEFIT_NOTES_TITLE = 'Notes on benefit estimates:';
const CUMULATIVE_IMPACT_TITLE = 'Cumulative impact estimate (low–high range, revenue lift)';
const CAVEATS_TITLE = 'Caveats:';

/** Validate + narrow the persisted `investments` jsonb through the Phase-0 contract. */
function parseInvestments(raw: unknown): MarketingAuditOutput {
  const parsed = marketingAuditOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`marketing_audits.investments failed marketing_audit contract: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Validate + narrow the persisted `rollout` jsonb through the Phase-0 contract. */
function parseRollout(raw: unknown): RolloutPlanOutput {
  const parsed = rolloutPlanOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`marketing_audits.rollout failed rollout_plan contract: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Ordered cell values for one Investment Matrix data row, matching the column order. */
function investmentRowValues(row: InvestmentRow): string[] {
  return [
    row.tier,
    row.investment,
    row.what_it_is,
    row.calendar_time,
    row.person_hours,
    row.level_of_effort,
    row.cash_cost,
    row.benefit_1mo,
    row.benefit_3mo,
    row.benefit_6mo,
    row.benefit_12mo,
  ];
}

/** Ordered cell values for one rollout phase row, matching the phase column order. */
function phaseRowValues(phase: RolloutPhase): string[] {
  return [phase.phase, phase.window, phase.action, phase.cash_needed, phase.why_now];
}

/**
 * Ordered cell values for one cumulative-impact row. Low/mid/high stay NUMERIC (the
 * fixture preserves them as JSON numbers); horizon + notes are strings.
 */
function cumulativeRowValues(row: CumulativeImpactRow): Array<string | number> {
  return [row.horizon, row.low, row.mid, row.high, row.notes];
}

/** Render the "Investment Matrix" sheet from the persisted investment rows. */
function buildInvestmentMatrixSheet(sheet: Worksheet, audit: MarketingAuditOutput): void {
  applyColumnWidths(sheet, WORKBOOK_B_COLUMN_WIDTHS);

  // Title (14pt navy — Workbook B convention) + self-flagging header note.
  applyTitle(sheet.addRow([INVESTMENT_MATRIX_TITLE]).getCell(1), 14);
  applyHeaderNote(sheet.addRow([INVESTMENT_MATRIX_HEADER_NOTE]).getCell(1));
  sheet.addRow([]);

  // Column-header row, then one color-banded data row per move (tier fill from style.ts).
  applyColumnHeaderRow(sheet.addRow([...INVESTMENT_MATRIX_COLUMNS]));
  for (const row of audit.rows) {
    applyDataRow(sheet.addRow(investmentRowValues(row)), { tier: row.tier });
  }

  // Tier legend block: banner row + one [tier, meaning] row each.
  sheet.addRow([]);
  applySectionTitleRow(sheet.addRow([TIER_LEGEND_TITLE]));
  for (const [tier, meaning] of TIER_LEGEND) {
    const legendRow = sheet.addRow([tier, meaning]);
    applyDataRow(legendRow, { tier });
  }

  // Notes on benefit estimates: banner row + one note per bullet.
  sheet.addRow([]);
  applySectionTitleRow(sheet.addRow([BENEFIT_NOTES_TITLE]));
  for (const note of BENEFIT_NOTES) {
    applySectionNote(sheet.addRow([note]).getCell(1));
  }
}

/** Render the "Recommended Phasing" sheet from the persisted rollout plan. */
function buildPhasingSheet(sheet: Worksheet, rollout: RolloutPlanOutput): void {
  applyColumnWidths(sheet, WORKBOOK_B_COLUMN_WIDTHS);

  applyTitle(sheet.addRow([PHASING_TITLE]).getCell(1), 14);
  applyHeaderNote(sheet.addRow([PHASING_HEADER_NOTE]).getCell(1));
  sheet.addRow([]);

  // Phase table: column-header row + one row per phase.
  applyColumnHeaderRow(sheet.addRow([...PHASING_COLUMNS]));
  for (const phase of rollout.phases) {
    applyDataRow(sheet.addRow(phaseRowValues(phase)));
  }

  // Cumulative-impact grid: banner + column-header + one row per horizon.
  sheet.addRow([]);
  applySectionTitleRow(sheet.addRow([CUMULATIVE_IMPACT_TITLE]));
  applyColumnHeaderRow(sheet.addRow([...CUMULATIVE_IMPACT_COLUMNS]));
  for (const impact of rollout.cumulative_impact) {
    applyDataRow(sheet.addRow(cumulativeRowValues(impact)));
  }

  // Caveats block: banner + one note per bullet.
  sheet.addRow([]);
  applySectionTitleRow(sheet.addRow([CAVEATS_TITLE]));
  for (const caveat of PHASING_CAVEATS) {
    applySectionNote(sheet.addRow([caveat]).getCell(1));
  }
}

/**
 * Assemble the full gold Workbook B from a persisted `marketing_audits` row.
 *
 * Pure over the persisted data: re-validates the stored `investments` / `rollout` jsonb
 * through the Phase-0 contracts (throwing on contract drift), then renders the two gold
 * sheets with the shared gold styling. No regeneration, no network, no identity.
 *
 * @throws if either persisted artifact fails its contract (a corrupt/legacy row).
 */
export function assembleWorkbookB(audit: MarketingAuditRecord): ExcelJS.Workbook {
  const investments = parseInvestments(audit.investments);
  const rollout = parseRollout(audit.rollout);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'IDEA Brand Coach';
  workbook.created = new Date(0); // deterministic timestamp so fixture renders are byte-stable
  workbook.modified = new Date(0); // pin both — ExcelJS embeds created/modified into core.xml; unpinned they default to wall-clock and break byte-determinism

  buildInvestmentMatrixSheet(workbook.addWorksheet(WORKBOOK_B_SHEET_NAMES[0]), investments);
  buildPhasingSheet(workbook.addWorksheet(WORKBOOK_B_SHEET_NAMES[1]), rollout);

  return workbook;
}
