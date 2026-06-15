// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { runWithIdentity, getIdentity, userTag, ANONYMOUS, type Identity } from '../context/identity.js';

const mk = (id: string): Identity => ({ userId: id, token: `tok-${id}`, authenticated: true });

describe('identity (AsyncLocalStorage isolation)', () => {
  it('returns ANONYMOUS outside any run scope', () => {
    expect(getIdentity()).toEqual(ANONYMOUS);
    expect(getIdentity().authenticated).toBe(false);
  });

  it('does not bleed identity across concurrent requests', async () => {
    const seen: Record<string, string[]> = { a: [], b: [] };

    const work = (key: 'a' | 'b', id: string) =>
      runWithIdentity(mk(id), async () => {
        seen[key].push(getIdentity().userId ?? 'none');
        await new Promise((r) => setTimeout(r, 5)); // force interleave across the await
        seen[key].push(getIdentity().userId ?? 'none');
        return getIdentity().userId;
      });

    const [ra, rb] = await Promise.all([work('a', 'alice'), work('b', 'bob')]);

    expect(ra).toBe('alice');
    expect(rb).toBe('bob');
    expect(seen.a).toEqual(['alice', 'alice']); // stable across the await — no bleed from bob
    expect(seen.b).toEqual(['bob', 'bob']);
    // scope fully torn down afterwards
    expect(getIdentity()).toEqual(ANONYMOUS);
  });

  it('userTag is non-reversible and stable; anon for unauthenticated', () => {
    expect(userTag(ANONYMOUS)).toBe('anon');
    const t1 = userTag(mk('alice'));
    const t2 = userTag(mk('alice'));
    expect(t1).toBe(t2);
    expect(t1).not.toContain('alice');
  });
});
