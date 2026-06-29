import { describe, it, expect } from 'vitest';
import {
  assembleOnboardState,
  type OnboardReadDeps,
} from '../service/onboardOrchestrator.js';
import type { ResolvedSlot, SlotStatus } from '../service/contextResolver.js';
import type { AvatarRow } from '../service/avatarLifecycle.js';
import type { FunnelTouchpoint } from '../service/funnelInventory.js';
import type { SlotId } from '../contracts/index.js';

/** All onboarding slots this service resolves. */
const ONBOARD_SLOTS: SlotId[] = [1, 2, 3, 4, 5, 6, 12, 13, 14, 15];

function slot(id: SlotId, status: SlotStatus): ResolvedSlot {
  return { slot: id, status, source: null, confidence: status.startsWith('filled') ? 0.9 : 0, value: null } as ResolvedSlot;
}

/** Resolve fixture: every onboarding slot `missing` unless overridden to a filled status. */
function resolved(filled: Partial<Record<SlotId, SlotStatus>> = {}): ResolvedSlot[] {
  return ONBOARD_SLOTS.map((id) => slot(id, filled[id] ?? 'missing'));
}

function avatar(p: Partial<AvatarRow> = {}): AvatarRow {
  return {
    id: 'a1',
    brand_id: 'b1',
    name: 'The Battle-Ready Collector',
    description: 'A serious adult TCG collector.',
    is_primary: true,
    created_at: '2026-06-28T00:00:00Z',
    updated_at: '2026-06-28T00:00:00Z',
    ...p,
  };
}

function touchpoint(p: Partial<FunnelTouchpoint> = {}): FunnelTouchpoint {
  return {
    id: 't1',
    brand_id: 'b1',
    touchpoint_id: 'amazon_listing_copy',
    stage: 'consideration',
    context_description: '',
    status: 'tracked',
    overall_score: null,
    created_at: '2026-06-28T00:00:00Z',
    ...p,
  };
}

function deps(over: {
  resolvedSlots?: ResolvedSlot[];
  avatars?: AvatarRow[];
  funnel?: FunnelTouchpoint[];
}): OnboardReadDeps {
  return {
    resolve: async () => over.resolvedSlots ?? resolved(),
    listAvatars: async () => over.avatars ?? [],
    listFunnel: async () => over.funnel ?? [],
  };
}

describe('assembleOnboardState — next-action ladder', () => {
  it('true cold start (nothing on file) → take_diagnostic (low-friction click-through)', async () => {
    const s = await assembleOnboardState(deps({}));
    expect(s.nextAction.id).toBe('take_diagnostic');
    expect(s.nextAction.tool).toBe('run_trust_gap');
    expect(s.avatars.total).toBe(0);
    expect(s.readyToDerive).toBe(false);
    // Recognition-first: the summary opens by reflecting the user's situation, then invites —
    // it does NOT open with a status dump or a checklist.
    expect(s.summary).not.toMatch(/^Here's where your brand stands/);
    expect(s.summary).toContain(s.nextAction.invite);
  });

  it('every next action carries a conversational invite (the interactive ask)', async () => {
    const scenarios: OnboardReadDeps[] = [
      deps({}), // take_diagnostic (cold)
      deps({ avatars: [], resolvedSlots: resolved({ 3: 'filled-evidence' }) }), // define_avatar
      deps({ avatars: [avatar()], resolvedSlots: resolved({ 15: 'filled-stated' }) }), // add_evidence
      deps({ avatars: [avatar()], resolvedSlots: resolved({ 1: 'filled-evidence', 3: 'filled-evidence' }) }), // derive
      deps({ avatars: [avatar()], resolvedSlots: resolved({ 3: 'filled-evidence', 15: 'filled-stated' }) }), // connect
      deps({
        avatars: [avatar()],
        resolvedSlots: resolved({ 1: 'filled-evidence', 3: 'filled-evidence', 15: 'filled-stated' }),
        funnel: [touchpoint({ overall_score: 70 })],
      }), // run_trust_gap
    ];
    for (const d of scenarios) {
      const s = await assembleOnboardState(d);
      expect(s.nextAction.invite.length).toBeGreaterThan(20);
      // No internal framework jargon leaks into the conversational ask.
      expect(s.nextAction.invite).not.toMatch(/\b(Insight|Distinctive|Empathetic|Authentic|S1|S4|Avatar 2\.0)\b/);
    }
  });

  it('placeholder-only avatars do not count as defined; with nothing else → still take_diagnostic', async () => {
    const s = await assembleOnboardState(
      deps({ avatars: [avatar({ name: 'Default Avatar', description: null }), avatar({ name: 'Avatar 2', description: '' })] }),
    );
    expect(s.avatars.defined).toBe(0);
    expect(s.avatars.placeholders).toBe(2);
    expect(s.nextAction.id).toBe('take_diagnostic');
  });

  it('engaged (evidence on file) but no defined avatar → define_avatar', async () => {
    const s = await assembleOnboardState(
      deps({ avatars: [], resolvedSlots: resolved({ 3: 'filled-evidence' }) }),
    );
    expect(s.avatars.defined).toBe(0);
    expect(s.nextAction.id).toBe('define_avatar');
  });

  it('defined primary, no evidence, no intake → take_diagnostic (low-friction MC rung)', async () => {
    const s = await assembleOnboardState(deps({ avatars: [avatar()] }));
    expect(s.nextAction.id).toBe('take_diagnostic');
    expect(s.nextAction.tool).toBe('run_trust_gap');
  });

  it('defined primary, no evidence, intake taken → add_evidence', async () => {
    const s = await assembleOnboardState(
      deps({ avatars: [avatar()], resolvedSlots: resolved({ 15: 'filled-stated' }) }),
    );
    expect(s.intakeTaken).toBe(true);
    expect(s.nextAction.id).toBe('add_evidence');
  });

  it('defined primary + evidence on file, no intake → derive_trust_gap (the keystone path)', async () => {
    const s = await assembleOnboardState(
      deps({ avatars: [avatar()], resolvedSlots: resolved({ 1: 'filled-evidence', 3: 'filled-evidence' }) }),
    );
    expect(s.readyToDerive).toBe(true);
    expect(s.nextAction.id).toBe('derive_trust_gap');
    expect(s.nextAction.tool).toBe('assess_idea_dimensions');
  });

  it('evidence + intake taken, no funnel metrics → connect_analytics', async () => {
    const s = await assembleOnboardState(
      deps({
        avatars: [avatar()],
        resolvedSlots: resolved({ 3: 'filled-evidence', 15: 'filled-stated' }),
        funnel: [touchpoint({ overall_score: null })],
      }),
    );
    expect(s.nextAction.id).toBe('connect_analytics');
  });

  it('everything present → run_trust_gap', async () => {
    const s = await assembleOnboardState(
      deps({
        avatars: [avatar()],
        resolvedSlots: resolved({ 1: 'filled-evidence', 3: 'filled-evidence', 15: 'filled-stated' }),
        funnel: [touchpoint({ overall_score: 72 })],
      }),
    );
    expect(s.nextAction.id).toBe('run_trust_gap');
    expect(s.funnel.withMetrics).toBe(1);
  });

  it('surfaces needs_input for unsatisfied slots and never throws on funnel failure', async () => {
    const failingFunnel: OnboardReadDeps = {
      resolve: async () => resolved({ 3: 'filled-evidence' }),
      listAvatars: async () => [avatar()],
      listFunnel: async () => {
        throw new Error('no brand yet');
      },
    };
    const s = await assembleOnboardState(failingFunnel);
    expect(s.funnel.pieces).toBe(0); // failed-soft
    expect(s.context.needsInput.length).toBeGreaterThan(0);
    expect(s.context.needsInput.every((n) => typeof n.question === 'string' && n.question.length > 0)).toBe(true);
  });
});
