// @vitest-environment node
/**
 * Phase 6 Agent A — Workbook A assembler cell-structure test.
 *
 * Strategy (per the goal prompt): derive artifact CONTENT from the committed gold
 * fixture A, feed it to `assembleWorkbookA`, then assert the produced workbook's
 * SHEET NAMES, HEADER ROWS, and ROW COUNTS match the fixture structure. This is a
 * cell-STRUCTURE test, not prose equality — it proves the assembler mirrors the gold
 * sheet layout (right sheets, right banner/column-header rows, right number of data
 * rows per block) without asserting every prose cell verbatim.
 *
 * The fixture .xlsx layout differs from the runtime contract shape in a few places
 * (interleaved canvas grid, signature options split across columns + rows, header-cell
 * scores). A thin in-test mapper bridges the two — the gold fixture is the source of
 * TRUTH for column/row counts, the contract is the source of truth for SHAPE.
 */
import { describe, it, expect } from 'vitest';
import workbookA from './fixtures/workbook-a.json';
import {
  assembleWorkbookA,
  projectWorkbookAArtifacts,
  type WorkbookAArtifacts,
} from '../service/workbook/assembleWorkbookA.js';
import type {
  DiagnosticInterpretationOutput,
  AvatarS1VocabOutput,
  AvatarS2JobmapOutput,
  AvatarS3TriggersOutput,
  AvatarS4ObjectionsOutput,
  SignatureOutput,
  BrandCanvasOutput,
  ExportBriefOutput,
  AuditXIdeaOutput,
  FrequencySignal,
} from '../contracts/index.js';
import { diagnosticInterpretationOutputSchema } from '../contracts/index.js';

// ---------------------------------------------------------------------------
// Gold fixture access helpers (shape from P0-A; typed loosely).
// ---------------------------------------------------------------------------
type Cell = string | number | null;
interface FixtureTable {
  name: string | null;
  note: string | null;
  columns: (string | null)[];
  rows: Cell[][];
}
interface FixtureSheet {
  sheet: string;
  title: string;
  header_note: string | null;
  tables: FixtureTable[];
}
const wbA = workbookA as { workbook: string; sheets: FixtureSheet[] };

function sheetByName(name: string): FixtureSheet {
  const sheet = wbA.sheets.find((s) => s.sheet === name);
  if (!sheet) throw new Error(`gold fixture missing sheet: ${name}`);
  return sheet;
}

// ---------------------------------------------------------------------------
// Fixture → artifact-content mappers (gold cells → contract output shape).
// ---------------------------------------------------------------------------

/** Sheet 3 "Diagnostic (IV)" → diagnostic_interpretation content. */
function mapDiagnostic(): DiagnosticInterpretationOutput {
  const sheet = sheetByName('3. Diagnostic (IV)');
  const dimsTable = sheet.tables.find((t) => t.columns.includes('Score / 25'))!;
  const dimensions = dimsTable.rows.map((r) => ({
    dimension: String(r[0]) as DiagnosticInterpretationOutput['dimensions'][number]['dimension'],
    score: Number(String(r[1]).split('/')[0].trim()),
    what_it_measures: String(r[2]),
    brand_read: String(r[3]),
    where_it_shows_up: String(r[4]),
  }));
  const content: DiagnosticInterpretationOutput = {
    overall_score: 58,
    primary_gap: 'Empathy',
    interpretation: dimsTable.name ?? 'Interpretation',
    dimensions,
    recommended_next_module: 'Avatar 2.0™',
    recommendation_rationale: 'Because the primary gap is Empathy, route into Avatar 2.0™.',
    grounding: 'inference',
    evidence_refs: [],
  };
  // Sanity: the mapped content must satisfy the contract.
  return diagnosticInterpretationOutputSchema.parse(content);
}

/** Sheet 4 Stage 1 → avatar_s1_vocab content. */
function mapS1(): AvatarS1VocabOutput {
  const sheet = sheetByName('4. Avatar 2.0 (IV)');
  const t = sheet.tables.find((tt) => tt.name?.startsWith('Stage 1'))!;
  return {
    clusters: t.rows.map((r) => ({
      cluster: String(r[0]),
      customer_words: String(r[1]).split(',').map((w) => w.trim()).filter(Boolean),
      frequency_signal: String(r[2]) as FrequencySignal,
      why_it_matters: String(r[3]),
    })),
    grounding: 'evidence',
    evidence_refs: [{ kind: 'review', ref: 'rev-1' }],
  };
}

/** Sheet 4 Stage 2 → avatar_s2_jobmap content. */
function mapS2(): AvatarS2JobmapOutput {
  const sheet = sheetByName('4. Avatar 2.0 (IV)');
  const t = sheet.tables.find((tt) => tt.name?.startsWith('Stage 2'))!;
  return {
    job_map: t.rows.map((r) => ({
      functional_job: String(r[0]),
      emotional_job: String(r[1]),
      identity_job: String(r[2]),
      villain: String(r[3]),
    })),
    grounding: 'evidence',
    evidence_refs: [{ kind: 'review', ref: 'rev-1' }],
  };
}

/** Sheet 4 Stage 3 → avatar_s3_triggers content. */
function mapS3(): AvatarS3TriggersOutput {
  const sheet = sheetByName('4. Avatar 2.0 (IV)');
  const t = sheet.tables.find((tt) => tt.name?.startsWith('Stage 3'))!;
  return {
    triggers: t.rows.map((r) => ({
      trigger_moment: String(r[0]),
      what_they_feel: String(r[1]),
      search_terms: String(r[2]).split(',').map((w) => w.trim()).filter(Boolean),
      estimated_volume_band: String(r[3]),
    })),
    grounding: 'evidence',
    evidence_refs: [{ kind: 'review', ref: 'rev-1' }],
  };
}

/** Sheet 4 Stage 4 → avatar_s4_objections content. */
function mapS4(): AvatarS4ObjectionsOutput {
  const sheet = sheetByName('4. Avatar 2.0 (IV)');
  const t = sheet.tables.find((tt) => tt.name?.startsWith('Stage 4'))!;
  return {
    objections: t.rows.map((r) => ({
      hesitation: String(r[0]),
      verbatim_signal: String(r[1]),
      resolution: String(r[2]),
    })),
    grounding: 'evidence',
    evidence_refs: [{ kind: 'review', ref: 'rev-1' }],
  };
}

/**
 * Sheet 4 Stage 5 → signature content. Gold stores Option 1 in the table's
 * columns ([col0="Option 1", col1=sentence]) and Options 2..N in the rows.
 */
function mapSignature(): SignatureOutput {
  const sheet = sheetByName('4. Avatar 2.0 (IV)');
  const t = sheet.tables.find((tt) => tt.name?.startsWith('Stage 5'))!;
  const options: SignatureOutput['options'] = [
    { option: 1, sentence: String(t.columns[1]) },
    ...t.rows.map((r, i) => ({ option: i + 2, sentence: String(r[1]) })),
  ];
  return {
    options,
    chosen_option: 1,
    grounding: 'inference',
    evidence_refs: [],
  };
}

/** Sheet 5 "Brand Canvas (IV)" → brand_canvas content (interleaved grid). */
function mapCanvas(): BrandCanvasOutput {
  const sheet = sheetByName('5. Brand Canvas (IV)');
  const t = sheet.tables.find((tt) => tt.name === 'The Signature')!;
  return {
    signature: t.note ?? 'The Signature',
    positioning: {
      category: String(t.columns[1]),
      position: 'Position',
      promise: 'Promise',
      villain: 'Villain',
      identity_payoff: 'Identity payoff',
    },
    voice: {
      voice_attributes: String(t.columns[3]),
      tone_dos: 'Tone do’s',
      tone_donts: 'Tone don’ts',
      words_we_use: ['collection', 'grail', 'chase'],
      words_we_dont: ['cheap', 'basic'],
    },
    story_spine: 'For collectors who’ve ever opened a binder and seen a dimple...',
    grounding: 'inference',
    evidence_refs: [],
  };
}

/** Sheet 6 "Export Brief" → export_brief content. */
function mapBrief(): ExportBriefOutput {
  const sheet = sheetByName('6. Export Brief');
  const listing = sheet.tables.find((t) => t.columns.includes('Example output'))!;
  const image = sheet.tables.find((t) => t.columns.includes('Slot'))!;
  // listing rows: row 0 = TITLE FORMULA, rows 1..5 = the 5 bullets.
  const titleRow = listing.rows[0];
  const bulletRows = listing.rows.slice(1);
  return {
    title_formula: {
      brief: String(titleRow[1]),
      example_output: String(titleRow[2]),
      product_truth_claims: [],
    },
    bullets: bulletRows.map((r) => ({
      element: String(r[0]),
      brief: String(r[1]),
      example_output: String(r[2]),
      stage_ref: 'canvas' as const,
      product_truth_claims: [],
    })),
    image_brief: image.rows.map((r) => ({
      slot: String(r[0]),
      intent: String(r[1]),
      brief: String(r[2]),
    })),
    ppc_keywords: {
      tier_a: ['binder that won’t damage cards', 'side loading card binder no slips'],
      tier_b: ['serious collector binder', 'premium card binder'],
      tier_c: ['9 pocket card binder', '216 card binder'],
    },
    grounding: 'inference',
    evidence_refs: [],
  };
}

/** Sheet 7 "Audit × IDEA" → audit_x_idea content. */
function mapAudit(): AuditXIdeaOutput {
  const sheet = sheetByName('7. Audit × IDEA');
  const t = sheet.tables.find((tt) => tt.columns.includes('Estimated lift multiplier'))!;
  return {
    rows: t.rows.map((r) => ({
      audit_investment: String(r[0]),
      without_idea: String(r[1]),
      with_idea: String(r[2]),
      estimated_lift: String(r[3]),
    })),
    grounding: 'inference',
    evidence_refs: [],
  };
}

/** A full chain map derived from the gold fixture. */
function fullArtifacts(): WorkbookAArtifacts {
  return {
    diagnostic_interpretation: mapDiagnostic(),
    avatar_s1_vocab: mapS1(),
    avatar_s2_jobmap: mapS2(),
    avatar_s3_triggers: mapS3(),
    avatar_s4_objections: mapS4(),
    signature: mapSignature(),
    brand_canvas: mapCanvas(),
    export_brief: mapBrief(),
    audit_x_idea: mapAudit(),
  };
}

/** First populated cell of a row (the banner/title text we anchor on). */
function firstCell(ws: import('exceljs').Worksheet, rowNumber: number): string {
  return String(ws.getRow(rowNumber).getCell(1).value ?? '');
}

/** All non-empty first-cell values in a sheet (in order) — the "row spine". */
function rowSpine(ws: import('exceljs').Worksheet): string[] {
  const spine: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const v = row.getCell(1).value;
    if (v !== null && v !== undefined && String(v).trim() !== '') spine.push(String(v));
  });
  return spine;
}

// ===========================================================================
describe('assembleWorkbookA', () => {
  it('emits the five artifact-driven gold sheets in order', () => {
    const wb = assembleWorkbookA(fullArtifacts());
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      '3. Diagnostic (IV)',
      '4. Avatar 2.0 (IV)',
      '5. Brand Canvas (IV)',
      '6. Export Brief',
      '7. Audit × IDEA',
    ]);
  });

  it('Diagnostic sheet has the gold header note, dimension column header, and 4 dimension rows', () => {
    const wb = assembleWorkbookA(fullArtifacts());
    const ws = wb.getWorksheet('3. Diagnostic (IV)')!;
    // Title row 1, header-note row 2.
    expect(firstCell(ws, 1)).toContain('Trust Gap™ Diagnostic');
    const spine = rowSpine(ws);
    expect(spine).toContain('Overall Trust Gap™ Score');
    expect(spine).toContain('The four dimensions');
    expect(spine).toContain('What the Diagnostic recommends next');
    // Dimension column-header row present.
    expect(spine).toContain('Dimension');
    // Exactly the 4 IDEA dimensions as data rows.
    expect(spine).toContain('Insight');
    expect(spine).toContain('Distinctiveness');
    expect(spine).toContain('Empathy');
    expect(spine).toContain('Authenticity');
    const gold = sheetByName('3. Diagnostic (IV)').tables.find((t) => t.columns.includes('Score / 25'))!;
    expect(gold.rows.length).toBe(4);
  });

  it('Avatar sheet renders all five stage blocks with gold row counts', () => {
    const arts = fullArtifacts();
    const wb = assembleWorkbookA(arts);
    const ws = wb.getWorksheet('4. Avatar 2.0 (IV)')!;
    const spine = rowSpine(ws);
    expect(spine).toContain('Stage 1 — Vocabulary Forensics');
    expect(spine).toContain('Stage 2 — Functional vs Emotional Job Map');
    expect(spine).toContain('Stage 3 — The Decision Trigger™');
    expect(spine.some((s) => s.startsWith('Stage 4'))).toBe(true);
    expect(spine.some((s) => s.startsWith('Stage 5'))).toBe(true);

    // Row counts trace to the gold fixture stage tables.
    const gold = sheetByName('4. Avatar 2.0 (IV)');
    const goldS1 = gold.tables.find((t) => t.name?.startsWith('Stage 1'))!;
    expect(arts.avatar_s1_vocab!.clusters.length).toBe(goldS1.rows.length); // 6 clusters
    const goldS3 = gold.tables.find((t) => t.name?.startsWith('Stage 3'))!;
    expect(arts.avatar_s3_triggers!.triggers.length).toBe(goldS3.rows.length); // 6 triggers
    // Signature: gold's Option 1 in columns + the remaining options in rows.
    expect(arts.signature!.options.length).toBe(4);
    // Chosen marker present on exactly one option row.
    const chosenRows = spine.filter((s) => s.startsWith('Option '));
    expect(chosenRows.length).toBe(4);
  });

  it('Brand Canvas sheet has Signature, Positioning grid, and story-spine blocks', () => {
    const wb = assembleWorkbookA(fullArtifacts());
    const ws = wb.getWorksheet('5. Brand Canvas (IV)')!;
    const spine = rowSpine(ws);
    expect(spine).toContain('The Signature');
    expect(spine).toContain('Positioning');
    expect(spine.some((s) => s.startsWith('Brand story spine'))).toBe(true);
    // The 4 positioning element rows.
    expect(spine).toContain('Position');
    expect(spine).toContain('Promise');
    expect(spine).toContain('Villain');
    expect(spine).toContain('Identity payoff');
  });

  it('Brand Canvas renders the story spine text exactly once (no duplicate block)', () => {
    const arts = fullArtifacts();
    const wb = assembleWorkbookA(arts);
    const ws = wb.getWorksheet('5. Brand Canvas (IV)')!;
    const spineText = arts.brand_canvas!.story_spine;
    // Count every cell across the whole sheet whose value equals the story spine.
    let occurrences = 0;
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (String(cell.value ?? '') === spineText) occurrences += 1;
      });
    });
    expect(occurrences).toBe(1);
  });

  it('Export Brief sheet has title formula + 5 bullets and 7 image slots', () => {
    const arts = fullArtifacts();
    const wb = assembleWorkbookA(arts);
    const ws = wb.getWorksheet('6. Export Brief')!;
    const spine = rowSpine(ws);
    expect(spine.some((s) => s.startsWith('Listing Copy Brief'))).toBe(true);
    expect(spine).toContain('TITLE FORMULA');
    expect(spine).toContain('Image Brief — what to take into Pixii (or a photographer)');
    expect(spine.some((s) => s.startsWith('PPC Keyword Brief'))).toBe(true);
    // 5 bullets + title formula = 6 listing rows; 7 image slots.
    expect(arts.export_brief!.bullets.length).toBe(5);
    expect(arts.export_brief!.image_brief.length).toBe(7);
    const goldImage = sheetByName('6. Export Brief').tables.find((t) => t.columns.includes('Slot'))!;
    expect(goldImage.rows.length).toBe(7);
  });

  it('Audit × IDEA sheet has the lift grid with gold row count', () => {
    const arts = fullArtifacts();
    const wb = assembleWorkbookA(arts);
    const ws = wb.getWorksheet('7. Audit × IDEA')!;
    const spine = rowSpine(ws);
    expect(spine).toContain('Lift per investment');
    expect(spine).toContain('Audit investment');
    const gold = sheetByName('7. Audit × IDEA').tables.find((t) => t.columns.includes('Estimated lift multiplier'))!;
    expect(arts.audit_x_idea!.rows.length).toBe(gold.rows.length);
  });

  it('renders only the sheets whose artifacts are present (partial chain)', () => {
    const wb = assembleWorkbookA({ diagnostic_interpretation: mapDiagnostic() });
    expect(wb.worksheets.map((w) => w.name)).toEqual(['3. Diagnostic (IV)']);
  });

  it('renders the avatar sheet when only one stage artifact is present', () => {
    const wb = assembleWorkbookA({ avatar_s1_vocab: mapS1() });
    expect(wb.worksheets.map((w) => w.name)).toEqual(['4. Avatar 2.0 (IV)']);
    const spine = rowSpine(wb.getWorksheet('4. Avatar 2.0 (IV)')!);
    expect(spine).toContain('Stage 1 — Vocabulary Forensics');
    expect(spine.some((s) => s.startsWith('Stage 2'))).toBe(false);
  });

  it('is deterministic — two assemblies of the same artifacts produce identical buffers', async () => {
    const arts = fullArtifacts();
    const buf1 = await assembleWorkbookA(arts).xlsx.writeBuffer();
    const buf2 = await assembleWorkbookA(arts).xlsx.writeBuffer();
    expect(Buffer.from(buf1).equals(Buffer.from(buf2))).toBe(true);
  });

  it('weaves a custom brand name into sheet titles', () => {
    const wb = assembleWorkbookA(fullArtifacts(), { brandName: 'Acme' });
    const ws = wb.getWorksheet('3. Diagnostic (IV)')!;
    expect(firstCell(ws, 1)).toContain('Acme');
  });

  it('projectWorkbookAArtifacts narrows a chain map to the Workbook A subset', () => {
    const projected = projectWorkbookAArtifacts({
      diagnostic_interpretation: mapDiagnostic(),
      marketing_audit: { foo: 'bar' }, // not a Workbook A kind — dropped
    });
    expect(projected.diagnostic_interpretation).toBeDefined();
    expect(Object.keys(projected)).not.toContain('marketing_audit');
  });
});
