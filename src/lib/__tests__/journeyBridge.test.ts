import { describe, it, expect } from 'vitest';
import {
  BRIDGE_ROUTE,
  COACH_ROUTE,
  parseGapParam,
  buildBridgePath,
  buildCoachPath,
  buildDeepDiveDestination,
  gapOpenerPrompt,
} from '../journeyBridge';
import { TRUST_GAP_DIMENSIONS } from '../trustGap';

describe('journeyBridge', () => {
  describe('parseGapParam', () => {
    it('accepts every known dimension', () => {
      for (const dim of TRUST_GAP_DIMENSIONS) {
        expect(parseGapParam(dim)).toBe(dim);
      }
    });

    it('rejects unknown / missing / malformed values as null', () => {
      expect(parseGapParam(null)).toBeNull();
      expect(parseGapParam(undefined)).toBeNull();
      expect(parseGapParam('')).toBeNull();
      expect(parseGapParam('INSIGHT')).toBeNull(); // case-sensitive guard
      expect(parseGapParam('empathy')).toBeNull(); // route slug, not the key
      expect(parseGapParam('<script>')).toBeNull();
    });
  });

  describe('buildBridgePath', () => {
    it('targets the bridge route with the gap param (CTA destination)', () => {
      expect(buildBridgePath('empathetic')).toBe(`${BRIDGE_ROUTE}?gap=empathetic`);
    });
  });

  describe('buildCoachPath', () => {
    it('targets the coach with the gap param', () => {
      expect(buildCoachPath('distinctive')).toBe(`${COACH_ROUTE}?gap=distinctive`);
    });
    it('targets the bare coach when there is no gap', () => {
      expect(buildCoachPath(null)).toBe(COACH_ROUTE);
    });
  });

  describe('buildDeepDiveDestination', () => {
    it('authed user goes straight to the coach with the gap', () => {
      expect(buildDeepDiveDestination('authentic', true)).toBe(`${COACH_ROUTE}?gap=authentic`);
    });

    it('guest is routed through the auth gate, preserving the coach+gap as an encoded redirect', () => {
      const dest = buildDeepDiveDestination('empathetic', false);
      expect(dest).toBe(`/auth?redirect=${encodeURIComponent('/v2/coach?gap=empathetic')}`);
      // round-trip: decoding the redirect yields the real coach path
      const redirect = new URLSearchParams(dest.split('?')[1]).get('redirect');
      expect(redirect).toBe('/v2/coach?gap=empathetic');
    });

    it('guest with no gap still gets a valid auth gate back to the bare coach', () => {
      const dest = buildDeepDiveDestination(null, false);
      expect(dest).toBe(`/auth?redirect=${encodeURIComponent('/v2/coach')}`);
    });
  });

  describe('gapOpenerPrompt', () => {
    it('produces a gap-specific, non-empty opener for each dimension', () => {
      const prompts = TRUST_GAP_DIMENSIONS.map((d) => gapOpenerPrompt(d));
      for (const p of prompts) expect(p.trim().length).toBeGreaterThan(0);
      // distinct per dimension
      expect(new Set(prompts).size).toBe(TRUST_GAP_DIMENSIONS.length);
    });
  });
});
