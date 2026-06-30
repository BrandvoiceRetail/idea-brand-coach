/**
 * Layer 3 (service) — Multi-avatar messaging-perception workbook assembler.
 *
 * Turns a SET of per-avatar messaging-perception judgements into a gold .xlsx: for ONE
 * planned strategic message, how each selected avatar perceives it (judged only from that
 * avatar's Avatar 2.0 forensics), rolled up to a weakest-link set verdict. Distinct from
 * {@link ./assembleWorkbookA} (one avatar's full IDEA chain) — this is `message × avatar`.
 *
 * PURE function over already-judged content — the assembler cardinal rule: it never
 * regenerates, never calls an edge fn, never touches Supabase or the network. The
 * perception judgements are produced upstream (the skill's Layer-2 orchestration) and
 * passed in; here we only format them. Same byte-determinism contract as Workbook A
 * (pinned creator / created / modified), so the same input always renders the same bytes.
 *
 * Sheets:
 *   1. "Message × Avatar"      — the matrix: avatars × the 4 dimension verdicts + overall,
 *                                topped by the SET weakest-link headline + reach summary.
 *   2. "{avatar} — perception" — one per avatar: the 4 dimensions with the avatar's quoted
 *                                evidence, overall verdict, provoked objections, and the
 *                                testable adjustments. A not-yet-analysable avatar renders
 *                                that line, not a score.
 *   3. "Set strategy"          — the split-signal call (one message vs segment), the
 *                                priority avatar, and the ranked cross-avatar adjustments.
 *
 * No fabrication: a not-analysable avatar (no Avatar 2.0) is reported honestly and counts
 * against the set's reach as an UNKNOWN — never silently dropped, never guessed.
 *
 * Styling comes entirely from {@link ./style.ts} so this file renders with the same visual
 * vocabulary as Workbook A/B.
 */
import ExcelJS from 'exceljs';
import type { Worksheet } from 'exceljs';
import {
  type MessagingPerceptionContent,
  type MessagingVerdict,
  MESSAGING_VERDICT_SEVERITY,
  MESSAGING_DIMENSION_KEYS,
  weakestVerdict,
} from '../../contracts/index.js';
import {
  applyTitle,
  applyHeaderNote,
  applySectionTitleRow,
  applySectionNote,
  applyColumnHeaderRow,
  applyDataRow,
  applyColumnWidths,
  type ColumnWidths,
} from './style.js';

/** Options for {@link assembleMessagingPerceptionWorkbook}. */
export interface AssembleMessagingPerceptionOptions {
  /** Brand/company name woven into sheet titles. Defaults to the gold brand. */
  brandName?: string;
}

/** The default brand name (matches the committed gold fixtures). */
const DEFAULT_BRAND_NAME = 'InfinityVault';

/** Fixed sheet names (the per-avatar perception sheets are named at render time). */
const SHEET_NAMES = {
  matrix: 'Message × Avatar',
  strategy: 'Set strategy',
} as const;

/** Human labels for the four dimension keys, in render order. */
const DIMENSION_LABELS: Readonly<Record<(typeof MESSAGING_DIMENSION_KEYS)[number], string>> = {
  vocabulary_fit: 'Vocabulary fit',
  job_resonance: 'Job resonance',
  trigger_hit: 'Trigger hit',
  objection_handling: 'Objection handling',
};

/** The honest "not yet analysable" token rendered in place of a score. */
const NOT_ANALYSABLE = 'not yet analysable';

/** Matrix: Avatar + the 4 dimension verdicts + overall verdict. */
const MATRIX_COLUMN_WIDTHS: ColumnWidths = [26, 16, 16, 16, 20, 16];
/** Per-avatar perception: Dimension | Verdict | Evidence. */
const PERCEPTION_COLUMN_WIDTHS: ColumnWidths = [22, 12, 56];
/** Set strategy: Priority | Avatar | Adjustment. */
const STRATEGY_COLUMN_WIDTHS: ColumnWidths = [10, 26, 54];

/**
 * Append a styled section block: a navy banner row (the section name), an optional gray
 * note row, a light-blue column-header row, then one styled data row per record. Mutates
 * the worksheet in place (the ExcelJS idiom) — mirrors `assembleWorkbookA`'s `appendTable`.
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

/**
 * A safe, unique worksheet name `{avatar} — perception`. Excel forbids `: \ / ? * [ ]`
 * in sheet names and caps the length at 31; duplicate avatar names get a `(n)` suffix.
 */
function perceptionSheetName(avatarName: string, used: Set<string>): string {
  const suffix = ' — perception';
  const cleaned = avatarName.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim() || 'Avatar';
  let base = `${cleaned}${suffix}`;
  if (base.length > 31) base = `${cleaned.slice(0, 31 - suffix.length).trim()}${suffix}`;

  let name = base;
  let n = 2;
  while (used.has(name)) {
    const tag = ` (${n})`;
    name = `${base.slice(0, 31 - tag.length)}${tag}`;
    n += 1;
  }
  used.add(name);
  return name;
}

/** The set-level rollup the matrix headline + Set strategy sheet both read from. */
interface SetSummary {
  analysable: MessagingPerceptionContent[];
  notAnalysable: MessagingPerceptionContent[];
  /** Weakest overall across the analysable avatars; `null` when none is analysable. */
  setVerdict: MessagingVerdict | null;
  served: MessagingPerceptionContent[];
  partial: MessagingPerceptionContent[];
  missed: MessagingPerceptionContent[];
}

/** Roll the set up: the not-analysable avatars are excluded from the verdict (unknown, not a pass). */
function summarise(perceptions: readonly MessagingPerceptionContent[]): SetSummary {
  const analysable = perceptions.filter((p) => p.analysable);
  const notAnalysable = perceptions.filter((p) => !p.analysable);
  return {
    analysable,
    notAnalysable,
    setVerdict: analysable.length ? weakestVerdict(analysable.map((p) => p.overall_verdict)) : null,
    served: analysable.filter((p) => p.overall_verdict === 'lands'),
    partial: analysable.filter((p) => p.overall_verdict === 'partial'),
    missed: analysable.filter((p) => p.overall_verdict === 'misses'),
  };
}

// ---------------------------------------------------------------------------
// Sheet 1 — Message × Avatar matrix
// ---------------------------------------------------------------------------
function buildMatrixSheet(
  wb: ExcelJS.Workbook,
  perceptions: readonly MessagingPerceptionContent[],
  brandName: string,
): void {
  const sheet = wb.addWorksheet(SHEET_NAMES.matrix);
  applyColumnWidths(sheet, MATRIX_COLUMN_WIDTHS);
  const message = perceptions.find((p) => p.message)?.message ?? '';
  appendSheetHeader(
    sheet,
    `Message × Avatar — ${brandName}`,
    `How each selected avatar perceives the planned message: “${message}”. Every verdict is inferred from that avatar’s own Avatar 2.0 forensics — never invented.`,
  );

  const s = summarise(perceptions);
  const headline = s.setVerdict
    ? `Set weakest link: ${s.setVerdict} — one message lands for the set only when it lands for every avatar.`
    : 'Set weakest link: not yet analysable — no selected avatar has an Avatar 2.0 built.';
  const reach = [
    `analysed ${s.analysable.length}/${perceptions.length}`,
    `lands ${s.served.length}`,
    `partial ${s.partial.length}`,
    `misses ${s.missed.length}`,
    `not yet analysable ${s.notAnalysable.length}`,
  ].join(' · ');

  appendTable(sheet, {
    sectionTitle: 'Set weakest link',
    note: headline,
    columns: ['Planned message', 'Set verdict (weakest link)', 'Reach'],
    rows: [[message, s.setVerdict ?? NOT_ANALYSABLE, reach]],
  });

  appendTable(sheet, {
    sectionTitle: 'Message × Avatar',
    note: 'One row per avatar. A not-yet-analysable avatar shows that, not a score (an unknown, not a pass).',
    columns: [
      'Avatar',
      DIMENSION_LABELS.vocabulary_fit,
      DIMENSION_LABELS.job_resonance,
      DIMENSION_LABELS.trigger_hit,
      DIMENSION_LABELS.objection_handling,
      'Overall verdict',
    ],
    rows: perceptions.map((p) =>
      p.analysable
        ? [
            p.avatar_name,
            p.dimensions.vocabulary_fit.verdict,
            p.dimensions.job_resonance.verdict,
            p.dimensions.trigger_hit.verdict,
            p.dimensions.objection_handling.verdict,
            p.overall_verdict,
          ]
        : [p.avatar_name, NOT_ANALYSABLE, '—', '—', '—', NOT_ANALYSABLE],
    ),
  });
}

// ---------------------------------------------------------------------------
// Sheet 2..N — one "{avatar} — perception" sheet per avatar
// ---------------------------------------------------------------------------
function buildPerceptionSheet(wb: ExcelJS.Workbook, p: MessagingPerceptionContent, sheetName: string): void {
  const sheet = wb.addWorksheet(sheetName);
  applyColumnWidths(sheet, PERCEPTION_COLUMN_WIDTHS);
  appendSheetHeader(sheet, `${p.avatar_name} — how they perceive the message`, `Planned message: “${p.message}”.`);

  if (!p.analysable) {
    appendTable(sheet, {
      sectionTitle: 'Not yet analysable',
      note: `${p.avatar_name} — not yet analysable; build their Avatar 2.0 (vocabulary → objections) first. Counts against the set’s reach as an unknown, never a pass.`,
      columns: ['Status'],
      rows: [[NOT_ANALYSABLE]],
    });
    return;
  }

  appendTable(sheet, {
    sectionTitle: `Dimension verdicts — overall: ${p.overall_verdict}`,
    note: 'Each verdict is read only from this avatar’s own S1–S4 forensics; the evidence is their own words.',
    columns: ['Dimension', 'Verdict', 'Evidence (their own words)'],
    rows: MESSAGING_DIMENSION_KEYS.map((k) => [DIMENSION_LABELS[k], p.dimensions[k].verdict, p.dimensions[k].evidence]),
  });

  appendTable(sheet, {
    sectionTitle: 'Provoked / unmet objections',
    note: 'Objections (S4) this message accidentally provokes or leaves unanswered.',
    columns: ['Objection'],
    rows: p.provoked_objections.length ? p.provoked_objections.map((o) => [o]) : [['None provoked by this message.']],
  });

  appendTable(sheet, {
    sectionTitle: 'Adjustments to test',
    note: 'Message tweaks that would raise the weakest verdicts — hypotheses to TEST (design_test), not settled claims.',
    columns: ['Adjustment (hypothesis to test)'],
    rows: p.adjustments.length
      ? p.adjustments.map((a) => [a])
      : [['No adjustment — the message already lands for this avatar.']],
  });
}

// ---------------------------------------------------------------------------
// Final sheet — Set strategy
// ---------------------------------------------------------------------------
function buildStrategySheet(
  wb: ExcelJS.Workbook,
  perceptions: readonly MessagingPerceptionContent[],
  brandName: string,
): void {
  const sheet = wb.addWorksheet(SHEET_NAMES.strategy);
  applyColumnWidths(sheet, STRATEGY_COLUMN_WIDTHS);
  appendSheetHeader(
    sheet,
    `Set strategy — ${brandName}`,
    'Does one message serve the whole set, or does it split? Plus the priority avatar and the ranked adjustments.',
  );

  const s = summarise(perceptions);

  // Split signal: one message only when it lands for EVERY analysed avatar AND every
  // selected avatar is analysable (an unknown can still split the set).
  const oneMessage = s.setVerdict === 'lands' && s.notAnalysable.length === 0;
  const splitCall =
    s.setVerdict === null
      ? 'No avatar is analysable yet — build at least one Avatar 2.0 before deciding.'
      : oneMessage
        ? 'One message lands across all analysed avatars — no segmentation needed yet.'
        : 'Split signal: one message does not serve every avatar — segment the message or commit to the priority avatar.';

  // Priority avatar = the set focus: the first analysable avatar in set order, falling
  // back to the first avatar in the set when none is analysable.
  const priority = s.analysable[0] ?? perceptions[0];

  appendTable(sheet, {
    sectionTitle: 'Split signal',
    note: splitCall,
    columns: ['One message or segment?', 'Set verdict', 'Priority avatar'],
    rows: [
      [
        oneMessage ? 'One message' : 'Segment',
        s.setVerdict ?? NOT_ANALYSABLE,
        priority ? priority.avatar_name : '—',
      ],
    ],
  });

  // Ranked adjustments: weakest avatars first (misses → partial → lands), stable within ties.
  const ranked = [...s.analysable].sort(
    (a, b) => MESSAGING_VERDICT_SEVERITY[b.overall_verdict] - MESSAGING_VERDICT_SEVERITY[a.overall_verdict],
  );
  const rows: string[][] = [];
  let rank = 1;
  for (const p of ranked) {
    for (const adj of p.adjustments) {
      rows.push([String(rank), p.avatar_name, adj]);
      rank += 1;
    }
  }

  appendTable(sheet, {
    sectionTitle: 'Ranked adjustments (weakest avatar first)',
    note: 'Concrete message tweaks ordered by which avatar the message fails hardest — each a hypothesis to TEST.',
    columns: ['Priority', 'Avatar', 'Adjustment (hypothesis to test)'],
    rows: rows.length ? rows : [['—', '—', 'No adjustments — the message lands for every analysed avatar.']],
  });
}

/**
 * Assemble the multi-avatar messaging-perception workbook from a set of per-avatar
 * judgements. Pure over `perceptions` — renders the matrix, one perception sheet per
 * avatar (in set order), then the Set strategy sheet. No regeneration, no LLM, no I/O.
 *
 * @param perceptions one judgement per selected avatar (already contract-validated).
 * @param opts        optional brand name woven into titles (defaults to the gold brand).
 * @returns an in-memory ExcelJS workbook ready for `xlsx.writeFile`/`writeBuffer`.
 */
export function assembleMessagingPerceptionWorkbook(
  perceptions: MessagingPerceptionContent[],
  opts: AssembleMessagingPerceptionOptions = {},
): ExcelJS.Workbook {
  const brandName = opts.brandName ?? DEFAULT_BRAND_NAME;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IDEA Brand Coach';
  wb.created = new Date(0); // deterministic timestamp so fixture renders are byte-stable
  wb.modified = new Date(0); // pin modified too — ExcelJS embeds dcterms:modified into core.xml

  buildMatrixSheet(wb, perceptions, brandName);

  // One perception sheet per avatar (content is always present per array element; a
  // not-analysable avatar still renders its honest "not yet analysable" sheet).
  const used = new Set<string>([SHEET_NAMES.matrix, SHEET_NAMES.strategy]);
  for (const p of perceptions) {
    buildPerceptionSheet(wb, p, perceptionSheetName(p.avatar_name, used));
  }

  buildStrategySheet(wb, perceptions, brandName);

  return wb;
}
