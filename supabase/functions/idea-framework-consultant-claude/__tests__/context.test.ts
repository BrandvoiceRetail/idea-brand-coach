import { describe, it, expect } from 'vitest';
import {
  retrieveUserContext,
  retrieveAllContext,
  AVATAR_SCOPED_CATEGORIES,
} from '../context';

/**
 * Two-tier (brand ∪ current-avatar) KB retrieval — the avatar-switch bleed fix.
 * See docs/v2/architecture/MULTI_AVATAR_DESIGN.md §2.2/§2.3.
 *
 * The fake Supabase query builder is a thenable that records the chained
 * filters and resolves against an in-memory row set, mimicking PostgREST
 * filter semantics for the columns this query uses.
 */

interface Row {
  field_identifier: string;
  category?: string;
  content: string;
  subcategory?: string | null;
  updated_at: string;
  user_id: string;
  scope: 'brand' | 'avatar';
  avatar_id: string | null;
  is_current: boolean;
}

function makeClient(rows: Row[]) {
  function builder(table: string) {
    const filters: Array<(r: Row) => boolean> = [];
    let limit = Infinity;
    let orderCol: string | null = null;
    let orderAsc = true;

    const chain: any = {
      _table: table,
      select() {
        return chain;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => (r as any)[col] === val);
        return chain;
      },
      is(col: string, val: unknown) {
        filters.push((r) => (r as any)[col] === val);
        return chain;
      },
      not(col: string, _op: string, val: unknown) {
        // .not('content','is',null) → content IS NOT null
        filters.push((r) => (r as any)[col] !== val);
        return chain;
      },
      gt(col: string, val: unknown) {
        filters.push((r) => (r as any)[col] > (val as any));
        return chain;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderCol = col;
        orderAsc = opts?.ascending !== false;
        return chain;
      },
      limit(n: number) {
        limit = n;
        return chain;
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve: (v: { data: Row[]; error: null }) => void) {
        let data = rows.filter((r) => filters.every((f) => f(r)));
        if (orderCol) {
          const col = orderCol;
          data = [...data].sort((a, b) => {
            const av = (a as any)[col];
            const bv = (b as any)[col];
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return orderAsc ? cmp : -cmp;
          });
        }
        data = data.slice(0, limit);
        resolve({ data, error: null });
      },
    };
    return chain;
  }
  return { from: (table: string) => builder(table) };
}

const USER = '11111111-1111-1111-1111-111111111111';
const AVATAR_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AVATAR_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function row(p: Partial<Row>): Row {
  return {
    field_identifier: 'f',
    category: 'general',
    content: 'x',
    subcategory: null,
    updated_at: '2026-06-01T00:00:00Z',
    user_id: USER,
    scope: 'brand',
    avatar_id: null,
    is_current: true,
    ...p,
  };
}

const fixture = (): Row[] => [
  row({ field_identifier: 'brand_canvas', category: 'canvas', content: 'BRAND CANVAS CONTENT', scope: 'brand', avatar_id: null }),
  row({ field_identifier: 'avatar_a_pain', category: 'avatar', content: 'AVATAR A PAIN', scope: 'avatar', avatar_id: AVATAR_A }),
  row({ field_identifier: 'avatar_a_insight', category: 'insights', content: 'AVATAR A INSIGHT', scope: 'avatar', avatar_id: AVATAR_A }),
  row({ field_identifier: 'avatar_b_pain', category: 'avatar', content: 'AVATAR B PAIN', scope: 'avatar', avatar_id: AVATAR_B }),
];

describe('retrieveUserContext — two-tier avatar-aware KB', () => {
  it('returns brand ∪ current-avatar rows, excluding other avatars', async () => {
    const ctx = await retrieveUserContext(makeClient(fixture()), USER, AVATAR_A, 'q', false);
    expect(ctx).toContain('BRAND CANVAS CONTENT'); // brand: shared
    expect(ctx).toContain('AVATAR A PAIN'); // avatar A: current
    expect(ctx).toContain('AVATAR A INSIGHT'); // insights category re-scoped to A
    expect(ctx).not.toContain('AVATAR B PAIN'); // avatar B: excluded — no bleed
  });

  it('after switching to avatar B excludes avatar A rows', async () => {
    const ctx = await retrieveUserContext(makeClient(fixture()), USER, AVATAR_B, 'q', false);
    expect(ctx).toContain('BRAND CANVAS CONTENT');
    expect(ctx).toContain('AVATAR B PAIN');
    expect(ctx).not.toContain('AVATAR A PAIN');
    expect(ctx).not.toContain('AVATAR A INSIGHT');
  });

  it('null avatar → brand-only (no avatar rows, no bleed)', async () => {
    const ctx = await retrieveUserContext(makeClient(fixture()), USER, null, 'q', false);
    expect(ctx).toContain('BRAND CANVAS CONTENT');
    expect(ctx).not.toContain('AVATAR A PAIN');
    expect(ctx).not.toContain('AVATAR B PAIN');
  });

  it('malformed avatar_id is rejected → treated as null (brand-only)', async () => {
    const ctx = await retrieveUserContext(
      makeClient(fixture()),
      USER,
      "not-a-uuid' OR 1=1; --" as any,
      'q',
      false
    );
    expect(ctx).toContain('BRAND CANVAS CONTENT');
    expect(ctx).not.toContain('AVATAR A PAIN');
    expect(ctx).not.toContain('AVATAR B PAIN');
  });

  it('minimal path returns both tiers (independent budgets)', async () => {
    // 8 brand + 8 avatar-A rows; minimal budget is 6 per tier, so both tiers
    // contribute and brand recency cannot starve avatar context.
    const many: Row[] = [];
    for (let i = 0; i < 8; i++) {
      many.push(row({ field_identifier: `b${i}`, category: 'canvas', content: `BRAND ${i}`, scope: 'brand', avatar_id: null, updated_at: `2026-06-10T00:00:0${i}Z` }));
    }
    for (let i = 0; i < 8; i++) {
      many.push(row({ field_identifier: `a${i}`, category: 'avatar', content: `AVATARA ${i}`, scope: 'avatar', avatar_id: AVATAR_A, updated_at: `2026-06-01T00:00:0${i}Z` }));
    }
    const ctx = await retrieveUserContext(makeClient(many), USER, AVATAR_A, 'q', true);
    // Both tiers get their own budget of 6 (most-recent), so neither starves
    // the other: avatar rows survive even though all 8 are older than brand.
    expect(ctx).toContain('AVATARA 7'); // avatar tier present
    expect(ctx).toContain('BRAND 7'); // brand tier present
    const avatarCount = (ctx.match(/AVATARA \d/g) || []).length;
    const brandCount = (ctx.match(/BRAND \d/g) || []).length;
    expect(avatarCount).toBe(6);
    expect(brandCount).toBe(6);
  });

  it('empty KB returns empty string', async () => {
    const ctx = await retrieveUserContext(makeClient([]), USER, AVATAR_A, 'q', false);
    expect(ctx).toBe('');
  });
});

describe('retrieveAllContext — threads avatarId through', () => {
  it('forwards avatarId to the two-tier read', async () => {
    const res = await retrieveAllContext(makeClient(fixture()), USER, 'q', {
      needsFullContext: true,
      hasUploadedDocuments: false,
      avatarId: AVATAR_A,
    });
    expect(res.userKnowledgeContext).toContain('AVATAR A PAIN');
    expect(res.userKnowledgeContext).not.toContain('AVATAR B PAIN');
  });

  it('missing avatarId → brand-only', async () => {
    const res = await retrieveAllContext(makeClient(fixture()), USER, 'q', {
      needsFullContext: true,
      hasUploadedDocuments: false,
    });
    expect(res.userKnowledgeContext).toContain('BRAND CANVAS CONTENT');
    expect(res.userKnowledgeContext).not.toContain('AVATAR A PAIN');
  });
});

describe('AVATAR_SCOPED_CATEGORIES', () => {
  it('matches the backfill policy (avatar + insights)', () => {
    expect([...AVATAR_SCOPED_CATEGORIES].sort()).toEqual(['avatar', 'insights']);
  });
});
