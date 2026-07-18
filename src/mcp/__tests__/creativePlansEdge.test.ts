// @vitest-environment node
/**
 * Creative-plan directors — EDGE CASES + determinism.
 *
 * The happy-path invariants live in creativePlans.test.ts; this file pins the BOUNDARIES a
 * refactor is most likely to regress: unknown/format fallbacks, trigger normalization,
 * empty/all-missing positioning (the new-user degrade must never throw or block), the
 * refine scope detector (component vs positioning, invalid/empty/all-elements), and the
 * purity contract (same input → byte-identical output — a stray Date.now()/random breaks it).
 */
import { describe, it, expect } from 'vitest';
import { buildVideoStoryboard, VIDEO_FORMATS } from '../service/videoStoryboard.js';
import { buildAplusPlan } from '../service/aplusPlan.js';
import { buildMainImageTitlePlan } from '../service/mainImageTitle.js';
import { buildStorefrontMessagingPlan } from '../service/storefrontMessaging.js';
import { buildUgcAdPlan, UGC_FORMATS } from '../service/ugcAdPlan.js';
import { buildCreativePlanRefinement } from '../service/refineCreativePlan.js';
import {
  normalizeTrigger,
  POSITIONING_SPINE,
  CREATIVE_PLAN_TYPES,
  reportPositioningInputs,
} from '../service/creativeAlignment.js';

describe('normalizeTrigger', () => {
  it('passes clean enum values through, lowercases, maps hyphen/space to underscore, nulls empties', () => {
    expect(normalizeTrigger('recognition')).toBe('recognition');
    expect(normalizeTrigger('Recognition')).toBe('recognition');
    expect(normalizeTrigger('fear-of-loss')).toBe('fear_of_loss'); // round-trips to the enum key
    expect(normalizeTrigger(null)).toBeNull();
    expect(normalizeTrigger(undefined)).toBeNull();
    expect(normalizeTrigger('')).toBeNull();
  });
});

describe('reportPositioningInputs — the honest degrade surface', () => {
  it('all-missing → every element missing, each pointing at its resolve tool (never a block)', () => {
    const rep = reportPositioningInputs({});
    expect(rep).toHaveLength(POSITIONING_SPINE.length);
    expect(rep.every((r) => r.status === 'missing')).toBe(true);
    for (const r of rep) {
      expect(r.note.toLowerCase()).toMatch(/resolve with:/);
      expect(r.note.toLowerCase()).not.toContain('refuse');
    }
  });
  it('treats whitespace-only values as missing, real values as provided', () => {
    const rep = reportPositioningInputs({ decisionTrigger: 'recognition', avatarSummary: '   ', positioning_statement: 'x' });
    const by = new Map(rep.map((r) => [r.element, r.status]));
    expect(by.get('decision_trigger')).toBe('provided');
    expect(by.get('avatar_core')).toBe('missing');
    expect(by.get('positioning_statement')).toBe('provided');
  });
});

describe('buildVideoStoryboard — edges', () => {
  it('an unknown format falls back to listing_video (never undefined)', () => {
    const r = buildVideoStoryboard({ product: 'X', format: 'not-a-format' });
    expect(r.format.key).toBe('listing_video');
    // every scene resolved from the library — no undefined scene leaked in
    expect(r.scenes.every((s) => s && typeof s.key === 'string' && s.scene > 0)).toBe(true);
  });
  it('honours a custom duration override in the summary', () => {
    const r = buildVideoStoryboard({ product: 'X', durationSeconds: 12 });
    expect(r.summary).toContain('~12s');
  });
  it('every format resolves all its scene keys to real scenes', () => {
    for (const f of VIDEO_FORMATS) {
      const r = buildVideoStoryboard({ product: 'X', format: f.key });
      expect(r.scenes.map((s) => s.key)).toEqual([...f.sceneKeys]);
      expect(r.scenes.some((s) => s === undefined)).toBe(false);
    }
  });
  it('produces a full plan from nothing but a product (new-user degrade, no throw)', () => {
    const r = buildVideoStoryboard({ product: 'Brand new, no context' });
    expect(r.ok).toBe(true);
    expect(r.trigger_hook_direction).toBeNull();
    expect(r.positioning_inputs.every((p) => p.status === 'missing')).toBe(true);
  });
});

describe('buildUgcAdPlan — edges', () => {
  it('an unknown ugc_format falls back to review', () => {
    expect(buildUgcAdPlan({ product: 'X', ugcFormat: 'bogus' }).format.key).toBe('review');
  });
  it('defaults platform to meta (social content_type); amazon_listing → amazon content_type', () => {
    expect(buildUgcAdPlan({ product: 'X' }).platform).toBe('meta');
    expect(buildUgcAdPlan({ product: 'X', platform: 'amazon_listing' }).instructions.join(' ')).toContain('content_type "amazon"');
  });
  it('every ugc format resolves its beats', () => {
    for (const f of UGC_FORMATS) {
      const r = buildUgcAdPlan({ product: 'X', ugcFormat: f.key });
      expect(r.beats.map((b) => b.key)).toEqual([...f.beatKeys]);
    }
  });
});

describe('buildCreativePlanRefinement — scope detector edges', () => {
  it('no positioning_changes → component scope, empty propagation', () => {
    const r = buildCreativePlanRefinement({ planType: 'aplus_content', changeRequest: 'tweak beat 2' });
    expect(r.change_scope).toBe('component');
    expect(r.propagation).toEqual([]);
  });
  it('an INVALID positioning element key is filtered out (falls back to component scope)', () => {
    const r = buildCreativePlanRefinement({
      planType: 'video_storyboard',
      changeRequest: 'x',
      // @ts-expect-error — exercising the runtime guard against a bad key
      positioningChanges: ['not_a_real_element'],
    });
    expect(r.change_scope).toBe('component');
    expect(r.propagation).toEqual([]);
  });
  it('ALL five elements changed → 5 propagation rows, each sweeping every OTHER plan type', () => {
    const r = buildCreativePlanRefinement({
      planType: 'listing_image_set',
      changeRequest: 'full reposition',
      positioningChanges: ['decision_trigger', 'avatar_core', 'positioning_statement', 'trust_gap_pillar', 'verified_facts'],
    });
    expect(r.change_scope).toBe('positioning');
    expect(r.propagation).toHaveLength(5);
    const others = CREATIVE_PLAN_TYPES.filter((p) => p !== 'listing_image_set');
    for (const entry of r.propagation) {
      expect(Object.keys(entry.other_plans).sort()).toEqual([...others].sort());
      expect(entry.this_plan.length).toBeGreaterThan(0);
    }
  });
  it('threads a provided assetId into the fetch instruction', () => {
    const r = buildCreativePlanRefinement({ planType: 'ugc_ad', changeRequest: 'x', assetId: 'asset_123' });
    expect(r.instructions.join(' ')).toContain('asset_123');
  });
});

describe('determinism — pure directors, same input → identical output', () => {
  const runs: Array<[string, () => unknown]> = [
    ['video', () => buildVideoStoryboard({ product: 'P', decisionTrigger: 'recognition', durationSeconds: 30 })],
    ['aplus', () => buildAplusPlan({ product: 'P', decisionTrigger: 'identity' })],
    ['main+title', () => buildMainImageTitlePlan({ product: 'P', positioning_statement: 'S' })],
    ['storefront', () => buildStorefrontMessagingPlan({ product: 'P', avatarSummary: 'A' })],
    ['ugc', () => buildUgcAdPlan({ product: 'P', ugcFormat: 'unboxing', decisionTrigger: 'momentum' })],
    ['refine', () => buildCreativePlanRefinement({ planType: 'aplus_content', changeRequest: 'c', positioningChanges: ['positioning_statement'] })],
  ];
  for (const [name, fn] of runs) {
    it(`${name} is deterministic`, () => {
      expect(JSON.stringify(fn())).toEqual(JSON.stringify(fn()));
    });
  }
});
