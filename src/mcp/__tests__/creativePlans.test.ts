// @vitest-environment node
/**
 * Creative-plan directors — the Higgsfield <-> brand-coach bridge.
 *
 * Proves the shared positioning spine holds across every surface: the propagation map
 * covers every (element × plan-type) cell, every director degrades honestly on missing
 * context (new users get a plan, not a wall), the Higgsfield handoff routes video
 * through the storyboard-image/per-scene modes with the exact negative prompt, claims
 * stay gated everywhere, Tier-C jargon stays forbidden, and refine_creative_plan keeps
 * component changes surgical while positioning changes sweep the other live plans.
 */
import { describe, it, expect } from 'vitest';
import {
  CREATIVE_PLAN_TYPES,
  POSITIONING_ELEMENT_KEYS,
  POSITIONING_PROPAGATION,
  POSITIONING_SPINE,
  HIGGSFIELD_HANDOFF,
  VIDEO_PROMPT_CONSTRUCTION,
  EXACT_VIDEO_NEGATIVE_PROMPT,
  reportPositioningInputs,
} from '../service/creativeAlignment.js';
import { buildVideoStoryboard, VIDEO_FORMATS, TRIGGER_HOOK_DIRECTION } from '../service/videoStoryboard.js';
import { buildAplusPlan, APLUS_BEATS } from '../service/aplusPlan.js';
import { buildMainImageTitlePlan, TITLE_FORMULA } from '../service/mainImageTitle.js';
import { buildStorefrontMessagingPlan, STOREFRONT_SECTIONS } from '../service/storefrontMessaging.js';
import { buildUgcAdPlan, UGC_FORMATS, UGC_TRIGGER_HOOK_ANGLE } from '../service/ugcAdPlan.js';
import { buildCreativePlanRefinement } from '../service/refineCreativePlan.js';

describe('creativeAlignment (the shared positioning spine)', () => {
  it('the propagation map covers every positioning element × every plan type', () => {
    for (const el of POSITIONING_ELEMENT_KEYS) {
      for (const plan of CREATIVE_PLAN_TYPES) {
        expect(POSITIONING_PROPAGATION[el][plan], `${el} × ${plan}`).toBeTruthy();
      }
    }
  });

  it('every spine element names a resolve tool and an honest degrade path (new users are never blocked)', () => {
    for (const el of POSITIONING_SPINE) {
      expect(el.resolveWith.length).toBeGreaterThan(0);
      expect(el.whenMissing.toLowerCase()).not.toContain('refuse');
    }
  });

  it('reportPositioningInputs marks provided vs missing and points missing ones at their tool', () => {
    const report = reportPositioningInputs({ decisionTrigger: 'recognition', avatarSummary: '  ' });
    const byKey = new Map(report.map((r) => [r.element, r]));
    expect(byKey.get('decision_trigger')?.status).toBe('provided');
    // whitespace-only counts as missing
    expect(byKey.get('avatar_core')?.status).toBe('missing');
    expect(byKey.get('signature')?.status).toBe('missing');
    expect(byKey.get('signature')?.note).toContain('generate_signature');
  });

  it('the video handoff carries both execution modes, the reference kit, and preset routing', () => {
    expect(HIGGSFIELD_HANDOFF.video.toLowerCase()).toContain('storyboard-image');
    expect(HIGGSFIELD_HANDOFF.video.toLowerCase()).toContain('per-scene');
    expect(HIGGSFIELD_HANDOFF.video.toLowerCase()).toMatch(/chain|prior clip/);
    expect(HIGGSFIELD_HANDOFF.reference_discipline.toLowerCase()).toMatch(/real product photo/);
    expect(HIGGSFIELD_HANDOFF.reference_discipline.toLowerCase()).toMatch(/never .*imagination/);
    expect(HIGGSFIELD_HANDOFF.preset_formats.toLowerCase()).toMatch(/ugc|unboxing/);
    expect(HIGGSFIELD_HANDOFF.edit_tools.toLowerCase()).toMatch(/reframe|upscale/);
  });

  it('VIDEO_PROMPT construction opens with the marker and ends with the exact negative prompt', () => {
    expect(VIDEO_PROMPT_CONSTRUCTION[0]).toContain('VIDEO_PROMPT:');
    expect(EXACT_VIDEO_NEGATIVE_PROMPT.toLowerCase()).toContain('negative prompt:');
    expect(EXACT_VIDEO_NEGATIVE_PROMPT.toLowerCase()).toMatch(/morphing product geometry|price tags/);
  });
});

describe('buildVideoStoryboard', () => {
  it('selects the scene architecture per format and numbers scenes in order', () => {
    for (const f of VIDEO_FORMATS) {
      const r = buildVideoStoryboard({ product: 'Trading card binder 2-pack', format: f.key });
      expect(r.format.key).toBe(f.key);
      expect(r.scenes.map((s) => s.key)).toEqual([...f.sceneKeys]);
      expect(r.scenes.map((s) => s.scene)).toEqual(f.sceneKeys.map((_, i) => i + 1));
    }
  });

  it('defaults to listing_video and tunes the hook to a supplied trigger', () => {
    const r = buildVideoStoryboard({ product: 'X', decisionTrigger: 'fear_of_loss' });
    expect(r.format.key).toBe('listing_video');
    expect(r.trigger_hook_direction).toBe(TRIGGER_HOOK_DIRECTION.fear_of_loss);
    expect(buildVideoStoryboard({ product: 'X' }).trigger_hook_direction).toBeNull();
  });

  it('amazon listing videos carry the channel policy (no price/promo/off-Amazon CTA)', () => {
    const r = buildVideoStoryboard({ product: 'X' });
    expect(r.format.channelRules.toLowerCase()).toMatch(/no pricing|no price/);
    expect(r.format.channelRules.toLowerCase()).toContain('sound-off');
  });

  it('adjustments are component-level: panel edits + single-job re-runs, edit tools before regen', () => {
    const r = buildVideoStoryboard({ product: 'X' });
    const joined = r.adjustment_protocol.join(' ').toLowerCase();
    expect(joined).toMatch(/one .*(job|scene)/);
    expect(joined).toContain('reframe');
    expect(joined).toContain('refine_creative_plan');
    expect(joined).not.toContain('regenerate the whole set —'); // never full-set regeneration as the path
  });

  it('degrades honestly on an empty spine and walks the new-user path', () => {
    const r = buildVideoStoryboard({ product: 'Brand-new seller, no context yet' });
    expect(r.positioning_inputs.every((p) => p.status === 'missing')).toBe(true);
    expect(r.new_user_path.join(' ')).toContain('get_context_status');
    expect(r.instructions.join(' ').toLowerCase()).toContain('log_asset');
  });

  it('routes UGC/unboxing to marketing-studio presets with the avatar-matched persona', () => {
    const r = buildVideoStoryboard({ product: 'X' });
    const ugc = r.preset_ad_formats.find((p) => p.key === 'ugc_ad');
    expect(ugc?.direction.toLowerCase()).toContain('avatar');
    expect(r.preset_ad_formats.map((p) => p.key)).toContain('unboxing');
  });
});

describe('buildAplusPlan', () => {
  it('runs the 5 beats in narrative order as one continuous composition', () => {
    const r = buildAplusPlan({ product: 'X' });
    expect(r.beats.map((b) => b.key)).toEqual(APLUS_BEATS.map((b) => b.key));
    expect(r.format.format.toLowerCase()).toContain('continuous');
    expect(r.summary.toLowerCase()).toContain('1472x3008');
  });

  it('carries the brand-registry gate, mobile rules, and the image prompt construction', () => {
    const r = buildAplusPlan({ product: 'X' });
    expect(r.brand_registry_note.toLowerCase()).toContain('brand registry');
    expect(r.mobile_rules.join(' ').toLowerCase()).toContain('mobile');
    expect(r.prompt_construction.steps[0]).toContain('IMAGE_PROMPT:');
  });
});

describe('buildMainImageTitlePlan', () => {
  it('plans the pair as one unit: policy-clean main image + the mobile-visible title formula', () => {
    const r = buildMainImageTitlePlan({ product: 'X', decisionTrigger: 'recognition' });
    expect(r.main_image.key).toBe('main');
    expect(r.main_image.amazonRules.toLowerCase()).toContain('white background');
    expect(TITLE_FORMULA.map((t) => t.key)).toContain('distinctive_difference');
    expect(r.title_rules.join(' ')).toMatch(/80 characters/);
    expect(r.coherence_rules.join(' ').toLowerCase()).toContain('same');
  });

  it('makes the pair the highest-traffic split test', () => {
    const r = buildMainImageTitlePlan({ product: 'X' });
    expect(r.test_plan.join(' ').toLowerCase()).toContain('design_test');
    expect(r.test_plan.join(' ').toLowerCase()).toContain('ctr');
  });
});

describe('buildStorefrontMessagingPlan', () => {
  it('covers the storefront sections in order with the hero routed to Higgsfield', () => {
    const r = buildStorefrontMessagingPlan({ product: 'X' });
    expect(r.sections.map((s) => s.key)).toEqual(STOREFRONT_SECTIONS.map((s) => s.key));
    const hero = r.sections.find((s) => s.key === 'store_hero');
    expect(hero?.execution).toBe('visual');
    expect(hero?.rules).toContain('3000×600');
  });

  it('enforces cross-surface consistency (one spine everywhere)', () => {
    const r = buildStorefrontMessagingPlan({ product: 'X' });
    const joined = r.consistency_rules.join(' ').toLowerCase();
    expect(joined).toContain('same');
    expect(joined).toContain('refine_creative_plan');
  });
});

describe('buildUgcAdPlan', () => {
  it('selects the script beats per format and numbers them in order', () => {
    for (const f of UGC_FORMATS) {
      const r = buildUgcAdPlan({ product: 'Trading card binder 2-pack', ugcFormat: f.key });
      expect(r.format.key).toBe(f.key);
      expect(r.beats.map((b) => b.key)).toEqual([...f.beatKeys]);
      expect(r.beats.map((b) => b.beat)).toEqual(f.beatKeys.map((_, i) => i + 1));
    }
  });

  it('defaults to the review format and angles the hook to a supplied trigger', () => {
    const r = buildUgcAdPlan({ product: 'X', decisionTrigger: 'momentum' });
    expect(r.format.key).toBe('review');
    expect(r.trigger_hook_angle).toBe(UGC_TRIGGER_HOOK_ANGLE.momentum);
    expect(buildUgcAdPlan({ product: 'X' }).trigger_hook_angle).toBeNull();
  });

  it('casts the persona from the customer avatar, never a random preset face', () => {
    const r = buildUgcAdPlan({ product: 'X' });
    const spec = r.persona_spec.join(' ').toLowerCase();
    expect(spec).toContain('avatar');
    expect(spec).toMatch(/not a generic influencer|never a random/);
  });

  it('carries the AI-presenter honesty rails (actor, never a fake customer; disclosure; policy)', () => {
    const r = buildUgcAdPlan({ product: 'X' });
    const joined = r.compliance.join(' ').toLowerCase();
    expect(joined).toContain('never framed as a real customer');
    expect(joined).toContain('disclosure');
    expect(joined).toMatch(/listing-video policy|no price/);
  });

  it('treats the hook as the test variable and closes the volume testing loop', () => {
    const r = buildUgcAdPlan({ product: 'X' });
    const joined = r.testing_plan.join(' ').toLowerCase();
    expect(joined).toContain('3 hook variants');
    expect(joined).toContain('design_test');
    expect(joined).toMatch(/scale the winning hook|scale the winner/);
    expect(joined).toContain('refine_creative_plan');
  });

  it('routes on-Amazon placements to amazon content_type and social elsewhere', () => {
    const amazon = buildUgcAdPlan({ product: 'X', platform: 'amazon_listing' });
    expect(amazon.instructions.join(' ')).toContain('content_type "amazon"');
    const social = buildUgcAdPlan({ product: 'X' });
    expect(social.instructions.join(' ')).toContain('content_type "social"');
  });
});

describe('buildCreativePlanRefinement', () => {
  it('a component change stays surgical: named components only, saved plan first, one job per change', () => {
    const r = buildCreativePlanRefinement({
      planType: 'video_storyboard',
      changeRequest: 'scene 3 should show the morning routine instead',
    });
    expect(r.change_scope).toBe('component');
    expect(r.propagation).toEqual([]);
    expect(r.surgical_protocol.join(' ').toLowerCase()).toContain('get_asset');
    expect(r.instructions.join(' ')).toContain('scene 3 should show the morning routine');
    expect(r.save_back.join(' ').toLowerCase()).toContain('external_id');
  });

  it('a positioning change propagates: this plan recomposes + every other live plan is swept', () => {
    const r = buildCreativePlanRefinement({
      planType: 'listing_image_set',
      changeRequest: 'we re-ran the diagnostic; the trigger is now momentum',
      positioningChanges: ['decision_trigger'],
    });
    expect(r.change_scope).toBe('positioning');
    expect(r.propagation).toHaveLength(1);
    const entry = r.propagation[0];
    expect(entry.this_plan).toBe(POSITIONING_PROPAGATION.decision_trigger.listing_image_set);
    // every OTHER plan type appears in the stale sweep
    const otherKeys = Object.keys(entry.other_plans);
    expect(otherKeys.sort()).toEqual(
      CREATIVE_PLAN_TYPES.filter((p) => p !== 'listing_image_set').slice().sort(),
    );
    expect(r.instructions.join(' ').toLowerCase()).toContain('list_assets');
  });

  it('dedupes repeated positioning changes', () => {
    const r = buildCreativePlanRefinement({
      planType: 'aplus_content',
      changeRequest: 'signature changed',
      positioningChanges: ['signature', 'signature'],
    });
    expect(r.propagation).toHaveLength(1);
  });
});

describe('shared guardrails across every director', () => {
  const results = [
    buildVideoStoryboard({ product: 'X' }),
    buildAplusPlan({ product: 'X' }),
    buildMainImageTitlePlan({ product: 'X' }),
    buildStorefrontMessagingPlan({ product: 'X' }),
    buildUgcAdPlan({ product: 'X' }),
  ];

  it('every plan carries the claim gate, evidence discipline, and the Tier-C jargon ban', () => {
    for (const r of results) {
      expect(r.claim_gate.toLowerCase()).toContain('confirm');
      expect(r.evidence_discipline.join(' ').toLowerCase()).toContain('verified facts');
      const banned = r.never_contain.join(' ');
      for (const term of ['Trust Gap', 'Decision Trigger', 'Assessor']) {
        expect(banned).toContain(term);
      }
    }
  });

  it('every plan instructs saving to the ledger and reports the positioning inputs', () => {
    for (const r of results) {
      expect(r.instructions.join(' ').toLowerCase()).toContain('log_asset');
      expect(r.positioning_inputs).toHaveLength(POSITIONING_SPINE.length);
    }
  });
});
