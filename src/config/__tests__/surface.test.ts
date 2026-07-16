import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CURRENT_SURFACE,
  classifyRoute,
  isCustomerReachable,
} from '../surface';
import { ROUTES } from '../routes';

const here = dirname(fileURLToPath(import.meta.url));
const appTsx = readFileSync(resolve(here, '../../App.tsx'), 'utf8');
const landingTsx = readFileSync(resolve(here, '../../pages/Landing.tsx'), 'utf8');

/** All `path="..."` / `path='...'` attributes registered in the router. */
function registeredRoutePaths(): string[] {
  const re = /path=(?:"([^"]+)"|'([^']+)')/g;
  const paths: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(appTsx)) !== null) paths.push(m[1] ?? m[2]);
  return [...new Set(paths)];
}

describe('surface manifest — internal consistency', () => {
  it('CURRENT_SURFACE is the customer surface', () => {
    expect(classifyRoute(CURRENT_SURFACE)).toBe('customer');
    expect(isCustomerReachable(CURRENT_SURFACE)).toBe(true);
  });

  it('classifies representative routes into the right tier', () => {
    expect(classifyRoute('/welcome')).toBe('customer');
    expect(classifyRoute('/auth')).toBe('infra');
    expect(classifyRoute('/admin/coach-evals')).toBe('internal');
    expect(classifyRoute('/v4/fix')).toBe('internal');
    expect(classifyRoute('/v2/coach')).toBe('internal');
    // Default-deny: anything not allowlisted is legacy → must redirect.
    expect(classifyRoute('/v1/dashboard')).toBe('legacy');
    expect(classifyRoute('/v1/start-here')).toBe('legacy');
    expect(classifyRoute('/some/brand-new/unknown/path')).toBe('legacy');
  });

  it('internal and legacy routes are NOT customer-reachable', () => {
    expect(isCustomerReachable('/v4/fix')).toBe(false);
    expect(isCustomerReachable('/v1/dashboard')).toBe(false);
  });
});

describe('surface leak guards (Decision 5)', () => {
  it('all "home" navigations land on the current surface, not legacy', () => {
    expect(ROUTES.HOME_PAGE).toBe(CURRENT_SURFACE);
  });

  it('the public landing does not send signed-in users into the legacy dashboard', () => {
    expect(landingTsx).not.toMatch(/navigate\(\s*['"]\/dashboard['"]\s*\)/);
  });

  it('every route the router registers is accounted for by the manifest', () => {
    // There is no "unclassified" — default-deny means unknown ⇒ legacy. This guard
    // exists so a *new* surface path added to App.tsx must be consciously placed in a
    // tier in surface.ts (otherwise it silently classifies legacy and gets redirected,
    // which the collapse gate below then flags).
    for (const p of registeredRoutePaths()) {
      expect(['customer', 'infra', 'internal', 'legacy']).toContain(classifyRoute(p));
    }
  });
});

/**
 * COLLAPSE GATE — the actual enforcement that only the current surface is customer-reachable.
 * Every legacy-classified absolute path must render a redirect (<Navigate>), never a real page
 * component. Nested relative paths (e.g. the /v4 spine's "diagnose") and the "*" 404 catch-all
 * are excluded — they aren't customer-facing legacy surfaces.
 */
describe('surface collapse — no legacy page is customer-reachable', () => {
  it('every legacy-classified route redirects instead of rendering a real page', () => {
    // Capture `<Route path="X" ... element={<Component ...>` → component name.
    const re =
      /<Route\s+[^>]*?path=(?:"([^"]+)"|'([^']+)')[^>]*?element=\{\s*<([A-Za-z0-9_]+)/g;
    const leaks: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(appTsx)) !== null) {
      const path = m[1] ?? m[2];
      const element = m[3];
      if (!path.startsWith('/')) continue; // nested relative child routes belong to their gated parent
      if (classifyRoute(path) === 'legacy' && element !== 'Navigate') {
        leaks.push(`${path} → <${element}>`);
      }
    }
    expect(leaks, `legacy routes still rendering real pages:\n${leaks.join('\n')}`).toEqual([]);
  });
});
