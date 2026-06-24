import { describe, it, expect } from 'vitest';
import { deriveEntitlement } from '@/hooks/useEntitlement';

describe('deriveEntitlement', () => {
  it('grants access when there are credits', () => {
    expect(deriveEntitlement(1, 'active')).toEqual({ hasActiveSub: true, hasAccess: true });
    expect(deriveEntitlement(5000, 'trialing')).toEqual({ hasActiveSub: true, hasAccess: true });
  });
  it('no access at zero / negative balance', () => {
    expect(deriveEntitlement(0, 'active')).toEqual({ hasActiveSub: true, hasAccess: false });
    expect(deriveEntitlement(-3, 'active')).toMatchObject({ hasAccess: false });
  });
  it('credits remain usable without an active sub (e.g. canceled with leftover credits)', () => {
    expect(deriveEntitlement(200, 'canceled')).toEqual({ hasActiveSub: false, hasAccess: true });
  });
  it('past_due / null are not active subs and have no access at 0 balance', () => {
    expect(deriveEntitlement(0, 'past_due')).toEqual({ hasActiveSub: false, hasAccess: false });
    expect(deriveEntitlement(0, null)).toEqual({ hasActiveSub: false, hasAccess: false });
  });
});
