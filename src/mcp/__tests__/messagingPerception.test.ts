// @vitest-environment node
/**
 * Multi-avatar messaging-perception — contract + assembler test.
 *
 * Mirrors the `workbookA.test.ts` pattern: load a small gold `MessagingPerceptionContent[]`
 * fixture, prove it parses against the contract (Phase-0 fixtures-parse-against-contracts
 * invariant), feed it to `assembleMessagingPerceptionWorkbook`, then assert the produced
 * workbook's SHEET NAMES and KEY CELLS — and that the render is byte-deterministic.
 *
 * The fixture holds three avatars: two analysable (Maya → `partial`, Rico → `misses`) and
 * one with no Avatar 2.0 (`Casual Collector` → not analysable), so the test exercises the
 * weakest-link set verdict, the per-avatar sheets, the not-analysable honesty path, and
 * the Set-strategy split call.
 */
import { describe, it, expect } from 'vitest';
import fixture from './fixtures/messaging-perception.json';
import {
  parseMessagingPerception,
  safeParseMessagingPerception,
  notAnalysablePerception,
  weakestVerdict,
  type MessagingPerceptionContent,
} from '../contracts/index.js';
import { assembleMessagingPerceptionWorkbook } from '../service/workbook/assembleMessagingPerceptionWorkbook.js';

/** The fixture, each entry parsed through the contract (proves it is contract-valid). */
function perceptions(): MessagingPerceptionContent[] {
  return (fixture.perceptions as unknown[]).map((p) => parseMessagingPerception(p));
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

/** Every cell value across a sheet, flattened (for asserting verdict tokens / ordering). */
function allCells(ws: import('exceljs').Worksheet): string[] {
  const cells: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      cells.push(String(cell.value ?? ''));
    });
  });
  return cells;
}

// ===========================================================================
describe('messagingPerception contract', () => {
  it('every fixture perception parses against the contract', () => {
    expect(() => perceptions()).not.toThrow();
    expect(perceptions()).toHaveLength(3);
  });

  it('weakestVerdict returns the worst verdict in the set', () => {
    expect(weakestVerdict(['lands', 'lands'])).toBe('lands');
    expect(weakestVerdict(['lands', 'partial'])).toBe('partial');
    expect(weakestVerdict(['partial', 'misses'])).toBe('misses');
    expect(weakestVerdict([])).toBe('lands');
  });

  it('overall_verdict MUST equal the weakest dimension when analysable', () => {
    const maya = perceptions()[0];
    // Maya's weakest dimension is trigger_hit=partial → overall must be partial.
    expect(maya.overall_verdict).toBe('partial');
    const bad = safeParseMessagingPerception({ ...maya, overall_verdict: 'lands' });
    expect(bad.success).toBe(false);
  });

  it('an analysable perception with empty evidence is rejected (no-fabrication bar)', () => {
    const maya = perceptions()[0];
    const bad = safeParseMessagingPerception({
      ...maya,
      dimensions: { ...maya.dimensions, vocabulary_fit: { verdict: 'lands', evidence: '' } },
    });
    expect(bad.success).toBe(false);
  });

  it('notAnalysablePerception builds an honest, contract-valid not-analysable shape', () => {
    const blank = notAnalysablePerception({ avatar_name: 'Ghost', message: 'msg' });
    expect(blank.analysable).toBe(false);
    expect(blank.provoked_objections).toEqual([]);
    expect(blank.adjustments).toEqual([]);
    expect(blank.dimensions.vocabulary_fit.evidence).toBe('');
    expect(safeParseMessagingPerception(blank).success).toBe(true);
    // A not-analysable perception that smuggles in objections is rejected.
    expect(safeParseMessagingPerception({ ...blank, provoked_objections: ['x'] }).success).toBe(false);
  });
});

describe('assembleMessagingPerceptionWorkbook', () => {
  it('emits the matrix, one perception sheet per avatar, then Set strategy', () => {
    const wb = assembleMessagingPerceptionWorkbook(perceptions());
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Message × Avatar',
      'Maya — perception',
      'Rico — perception',
      'Casual Collector — perception',
      'Set strategy',
    ]);
  });

  it('Message × Avatar matrix has the weakest-link headline and a row per avatar', () => {
    const wb = assembleMessagingPerceptionWorkbook(perceptions());
    const ws = wb.getWorksheet('Message × Avatar')!;
    const spine = rowSpine(ws);
    expect(spine).toContain('Set weakest link');
    expect(spine).toContain('Message × Avatar');
    expect(spine).toContain('Maya');
    expect(spine).toContain('Rico');
    expect(spine).toContain('Casual Collector');
    // Set verdict = weakest of {partial, misses} = misses (the not-analysable avatar is excluded).
    const cells = allCells(ws);
    expect(cells).toContain('misses');
    // The not-analysable avatar renders the honest label, not a score.
    expect(cells).toContain('not yet analysable');
  });

  it('a per-avatar perception sheet carries the 4 dimensions, objections and adjustments', () => {
    const wb = assembleMessagingPerceptionWorkbook(perceptions());
    const ws = wb.getWorksheet('Maya — perception')!;
    const spine = rowSpine(ws);
    expect(spine.some((s) => s.startsWith('Dimension verdicts — overall: partial'))).toBe(true);
    expect(spine).toContain('Provoked / unmet objections');
    expect(spine).toContain('Adjustments to test');
    // The 4 dimension labels are present as data rows.
    expect(spine).toContain('Vocabulary fit');
    expect(spine).toContain('Job resonance');
    expect(spine).toContain('Trigger hit');
    expect(spine).toContain('Objection handling');
  });

  it('the not-analysable avatar sheet renders the honest line, not a score', () => {
    const wb = assembleMessagingPerceptionWorkbook(perceptions());
    const ws = wb.getWorksheet('Casual Collector — perception')!;
    const spine = rowSpine(ws);
    expect(spine).toContain('Not yet analysable');
    expect(spine.some((s) => s.startsWith('Dimension verdicts'))).toBe(false);
  });

  it('Set strategy calls the split and ranks the weakest avatar first', () => {
    const wb = assembleMessagingPerceptionWorkbook(perceptions());
    const ws = wb.getWorksheet('Set strategy')!;
    const spine = rowSpine(ws);
    expect(spine).toContain('Split signal');
    expect(spine).toContain('Ranked adjustments (weakest avatar first)');
    const cells = allCells(ws);
    // The set misses → segment, not one message.
    expect(cells).toContain('Segment');
    // Priority avatar = first analysable (Maya).
    expect(cells).toContain('Maya');
    // Ranked adjustments: Rico (misses) ranks above Maya (partial).
    const ricoIdx = cells.indexOf('Rico');
    const mayaRankedIdx = cells.lastIndexOf('Maya');
    expect(ricoIdx).toBeGreaterThanOrEqual(0);
    expect(ricoIdx).toBeLessThan(mayaRankedIdx);
  });

  it('weaves a custom brand name into sheet titles', () => {
    const wb = assembleMessagingPerceptionWorkbook(perceptions(), { brandName: 'Acme' });
    const ws = wb.getWorksheet('Message × Avatar')!;
    expect(String(ws.getRow(1).getCell(1).value ?? '')).toContain('Acme');
  });

  it('is deterministic — two assemblies of the same content produce identical buffers', async () => {
    const ps = perceptions();
    const buf1 = await assembleMessagingPerceptionWorkbook(ps).xlsx.writeBuffer();
    const buf2 = await assembleMessagingPerceptionWorkbook(ps).xlsx.writeBuffer();
    expect(Buffer.from(buf1).equals(Buffer.from(buf2))).toBe(true);
  });
});
