/**
 * Twin-sync guard — parse-amazon.ts (edge fn) ↔ parseAmazonProduct.ts (SPA).
 *
 * The two files are deliberate verbatim twins (Deno edge functions can only
 * bundle their own folder + _shared, so the SPA module cannot be imported
 * there). Until now the "must stay behaviorally identical" rule lived only in
 * a header comment; this test enforces it mechanically. The headers may
 * differ; everything from the first export onward must be byte-identical.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');

function bodyFromFirstExport(path: string): string {
  const source = readFileSync(resolve(ROOT, path), 'utf8');
  const start = source.indexOf('export interface ParsedReview');
  if (start === -1) throw new Error(`No "export interface ParsedReview" anchor in ${path}`);
  return source
    .slice(start)
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

describe('parse-amazon twin files', () => {
  it('edge copy and SPA copy are identical from the first export onward', () => {
    const edge = bodyFromFirstExport('supabase/functions/import-product-data/parse-amazon.ts');
    const spa = bodyFromFirstExport('src/lib/parseAmazonProduct.ts');
    expect(edge).toBe(spa);
  });
});
