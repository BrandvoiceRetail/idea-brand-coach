/**
 * Tier-C terminology-leak guard for the entire /v4 surface.
 *
 * WHAT: A deterministic source-scan that runs `findTierViolations` (the canonical
 * frontend Tier-B/C guard in megapromptParse.ts) over every shipped /v4 source
 * file and asserts ZERO leaks. This complements the per-component render-time
 * assertions (which check the strings a single screen produces) with a static
 * sweep that catches a hard-coded internal term anywhere in the surface —
 * including blurbs, service notes, and copy that a unit test might not render.
 *
 * WHY: Tier-C internals (Safety-brain / S1–S4 stage labels / CAPTURE element
 * names / raw buyer-state names / neuroanatomy / engine field keys) must NEVER
 * reach a user. One static guard over the whole tree is cheaper to keep honest
 * than trusting every future screen to add its own assertion.
 *
 * Scope: scans .ts/.tsx under the /v4 dirs, excluding the guard source itself
 * (it defines the forbidden patterns) and __tests__ (they reference the terms on
 * purpose). Markdown docs (AGENTS.md) are out of scope — they describe the policy.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findTierViolations } from '@/lib/v4/megapromptParse';

const ROOT = resolve(__dirname, '../../..'); // -> src/

/** The shipped /v4 source roots (dirs + the standalone v4 type modules). */
const V4_TARGETS = [
  'pages/v4',
  'components/v4',
  'services/v4',
  'lib/v4',
  'hooks', // useRemeasureRun / useDefendRun live here; filtered to v4* below
  'types/v4Analyse.ts',
  'types/v4Fix.ts',
  'types/v4Remeasure.ts',
  'types/v4Defend.ts',
];

/** Files that legitimately contain the forbidden tokens and must be skipped. */
function isExcluded(path: string): boolean {
  if (path.includes('__tests__')) return true;
  if (path.endsWith('megapromptParse.ts')) return true; // the guard defines the patterns
  return false;
}

function isV4SourceFile(path: string): boolean {
  if (!/\.(ts|tsx)$/.test(path)) return false;
  if (isExcluded(path)) return false;
  // The shared hooks/ dir is broad — only scan the v4-specific hooks.
  if (path.includes(`${join('src', 'hooks')}`)) {
    return /(\/|\\)use(Remeasure|Defend|V4)\w*\.tsx?$/.test(path);
  }
  return true;
}

function walk(path: string): string[] {
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(path);
  } catch {
    return [];
  }
  if (stat.isDirectory()) {
    return readdirSync(path).flatMap((entry) => walk(join(path, entry)));
  }
  return [path];
}

function collectV4Files(): string[] {
  return V4_TARGETS.flatMap((t) => walk(join(ROOT, t))).filter(isV4SourceFile);
}

describe('/v4 terminology-leak guard', () => {
  const files = collectV4Files();

  it('discovers the shipped /v4 source files', () => {
    // Guards the scan itself: if globbing breaks, the leak assertions would pass
    // vacuously. The surface is dozens of files — assert a sane floor.
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [f.slice(ROOT.length + 1), f] as const))(
    'src/%s contains no Tier-C / buyer-state leaks',
    (_label, file) => {
      const violations = findTierViolations(readFileSync(file, 'utf8'));
      expect(
        violations,
        violations.map((v) => `"${v.term}" (${v.rule})`).join(', '),
      ).toEqual([]);
    },
  );
});
