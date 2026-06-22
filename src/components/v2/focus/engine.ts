/**
 * Focus engine — pure logic.
 *
 *  - buildFocusQueue(snapshot): turns the brand's Trust Gap™ + state into a PRIORITISED list of
 *    focuses; the first is the one thing that needs the owner now. Direction is evidence-led:
 *    the lowest pillar decides the primary Decision Trigger™ (Skills 06/09), Dove anchors fixed.
 *  - composeDeliverable(...): produces a stage-adaptive deliverable from the focus + the owner's
 *    dictated idea. Deterministic templates today; `generate` is the seam to the live coach
 *    (generate_brief / draft_asset / generate_canvas) — wire there without changing the UI.
 */
import type {
  BrandSnapshot,
  Deliverable,
  DeliverableMode,
  DecisionTriggerName,
  FocusItem,
  Pillar,
} from './types';

const PILLAR_LABEL: Record<Pillar, string> = {
  insight: 'Insight',
  distinctive: 'Distinctive',
  empathetic: 'Empathetic',
  authentic: 'Authentic',
};

/** Lowest pillar → primary trigger (Skill 09). */
const PILLAR_TRIGGER: Record<Pillar, DecisionTriggerName> = {
  insight: 'Permission',
  distinctive: 'Identity',
  empathetic: 'Recognition',
  authentic: 'Belonging',
};

/** Fixed brand anchors (corrected: Recognition = Dove, not Lego). */
export const TRIGGER_ANCHOR: Record<DecisionTriggerName, string> = {
  Permission: 'Harvard Medical School',
  Recognition: 'Dove',
  Identity: 'Apple',
  Belonging: 'Patagonia',
  Momentum: "Amazon's Choice",
  'Fear-of-Loss': 'a FOMO / time-sensitivity signal',
};

/** One plain-language line on what the customer needs, per trigger (no jargon, no buyer states). */
const TRIGGER_NEED: Record<DecisionTriggerName, string> = {
  Permission: 'They are evaluating you and cannot find the proof they need — lead with credible evidence.',
  Recognition: 'They need to feel you understand their situation before they will trust your evidence.',
  Identity: 'They buy who they want to be — your brand has not claimed its identity territory.',
  Belonging: 'They want to know what you stand for before they commit — lead with your values and story.',
  Momentum: 'They are ready to commit and need the final nudge of social-proof volume.',
  'Fear-of-Loss': 'They are motivated by the cost of waiting — frame what they lose by not acting.',
};

/** Build the prioritised focus queue. First item = the one thing that needs the owner now. */
export function buildFocusQueue(s: BrandSnapshot): FocusItem[] {
  const items: FocusItem[] = [];

  if (s.trustGap) {
    const { pillars, primaryGap } = s.trustGap;
    // Primary fix focus — the lowest pillar drives the trigger.
    const trigger = PILLAR_TRIGGER[primaryGap];
    items.push({
      id: `fix-${primaryGap}`,
      kind: 'fix',
      title: `Fix your ${PILLAR_LABEL[primaryGap]} gap — the one change that will move conversion most`,
      why: `${PILLAR_LABEL[primaryGap]} is your weakest dimension (${pillars[primaryGap]}/25). ${TRIGGER_NEED[trigger]}`,
      pillar: primaryGap,
      trigger,
      anchor: TRIGGER_ANCHOR[trigger],
      evidence: s.evidence.slice(0, 3),
      priorityScore: 100 + (25 - pillars[primaryGap]),
      modes: ['diy-listing', 'designer-brief'],
    });
    // Secondary pillar gaps become queued fixes (lower priority).
    (Object.keys(pillars) as Pillar[])
      .filter((p) => p !== primaryGap && pillars[p] < 15)
      .sort((a, b) => pillars[a] - pillars[b])
      .forEach((p) => {
        const t = PILLAR_TRIGGER[p];
        items.push({
          id: `fix-${p}`,
          kind: 'fix',
          title: `Strengthen your ${PILLAR_LABEL[p]} signal next`,
          why: `${PILLAR_LABEL[p]} is also weak (${pillars[p]}/25). Address it once the primary fix is shipped.`,
          pillar: p,
          trigger: t,
          anchor: TRIGGER_ANCHOR[t],
          evidence: [],
          priorityScore: 40 + (25 - pillars[p]),
          modes: ['diy-listing', 'designer-brief'],
        });
      });
  } else {
    // No diagnostic yet — the foundation is the first thing that needs them.
    items.push({
      id: 'foundation-diagnose',
      kind: 'foundation',
      title: 'Run your Trust Gap™ — find what is actually losing you conversions',
      why: 'We have no diagnostic yet. Score your listing on the four pillars so the coach can point you at the single highest-leverage fix.',
      evidence: [],
      priorityScore: 120,
      modes: ['canvas'],
    });
  }

  // Brand foundation focus — keep the definition current (lower priority than an open fix).
  if (s.avatar) {
    items.push({
      id: 'foundation-canvas',
      kind: 'foundation',
      title: 'Keep your brand definition current',
      why: 'Your avatar and strategy drive every asset. Refresh the canvas so new work stays coherent.',
      evidence: [],
      priorityScore: 30,
      modes: ['canvas'],
    });
  }

  // Competitor move — only surfaces (and jumps priority) when one is flagged.
  if (s.competitorMove) {
    items.push({
      id: 'competitor-move',
      kind: 'competitor',
      title: 'A competitor just moved — respond before it costs you',
      why: s.competitorMove,
      evidence: [],
      priorityScore: 80,
      modes: ['competitor'],
    });
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore);
}

/** Inputs a deliverable is composed from. `idea` is the owner's dictated reaction (may be empty). */
export interface ComposeInput {
  focus: FocusItem;
  snapshot: BrandSnapshot;
  mode: DeliverableMode;
  idea?: string;
}

const ev = (f: FocusItem) => (f.evidence.length ? f.evidence.map((e) => `“${e}”`).join(' · ') : 'your review corpus');
const ideaLine = (idea?: string) => (idea?.trim() ? `\n\nYour steer: ${idea.trim()}` : '');

/** Detect claims that need owner confirmation before publishing (compliance gate). */
export function detectClaimFlags(text: string): string[] {
  const flags: string[] = [];
  if (/\b(lifetime|guarantee|warranty)\b/i.test(text)) flags.push('Guarantee/warranty claim — confirm you offer it before publishing.');
  if (/\b(clinically|doctor|dermatologist|FDA|cure|treat)\b/i.test(text)) flags.push('Health/authority claim — confirm it is substantiated + in your safe-claims set.');
  return flags;
}

/** Stage-adaptive deliverable composer (deterministic template; live coach plugs into `generate`). */
export function composeDeliverable(input: ComposeInput): Deliverable {
  const { focus, snapshot, mode, idea } = input;
  const product = snapshot.product ?? snapshot.brand;
  const anchor = focus.anchor ?? 'the right cultural reference';
  const objection = snapshot.avatar?.topObjection || 'their main hesitation';

  if (mode === 'designer-brief') {
    const body = [
      `CONTEXT (for your designer): ${focus.why} Lead with this before any product claim.`,
      `IMAGE: the hero must communicate — in the first three seconds, before any text — that the brand understands the customer’s situation (${anchor}-style emotional mirroring). Show the moment/relief, not just the product. Make the key reassurance signal visible at a glance.`,
      `COPY: headline mirrors the customer’s experience in their own words (${ev(focus)}); opening bullet acknowledges ${objection}; the proof follows, not leads.`,
      `PLACEMENT: make this change in the hero image headline and your opening bullet point first — everything else can follow in a second iteration once tested.`,
    ].join('\n\n') + ideaLine(idea);
    return {
      mode,
      title: `Design brief — ${focus.trigger ?? 'fix'} (${anchor})`,
      body,
      pasteablePrompt: `Hero product image for ${product}: a customer feeling understood and reassured — ${anchor}-style honest emotional mirroring (the moment of relief, warm natural light), the product present but secondary, the key trust signal clearly visible. Leave clear space top-left for a headline. Photoreal, premium, uncluttered.`,
      claimFlags: detectClaimFlags(`${focus.why} ${idea ?? ''}`),
    };
  }

  if (mode === 'canvas') {
    const body = [
      `BRAND: ${snapshot.brand}${snapshot.product ? ` — ${snapshot.product}` : ''}`,
      `WHO YOU SERVE: ${snapshot.avatar?.whyBuyingToday ?? 'the customer at their moment of need (run the diagnostic to fill this).'}`,
      `WHAT STOPS THEM: ${objection}`,
      `HOW THEY TALK: ${snapshot.avatar?.howTheyTalk ?? '(from your reviews)'}`,
      `WHAT EARNS TRUST: ${snapshot.avatar?.trustSignals ?? '(from your reviews)'}`,
      `THE ONE LEVER: ${focus.trigger ? `${focus.trigger} (${anchor})` : 'run the diagnostic to find it'} — ${focus.why}`,
    ].join('\n') + ideaLine(idea);
    return { mode, title: 'Brand canvas (working)', body, claimFlags: detectClaimFlags(idea ?? '') };
  }

  if (mode === 'competitor') {
    const body = [
      `WHAT MOVED: ${focus.why}`,
      `YOUR RESPONSE: do not copy them — out-execute on the dimension your reviews say your customer cares about most (${ev(focus)}). `,
      `THE MOVE: update your hero + opening bullet to make your strongest trust signal unmissable, and answer ${objection} more directly than they do.`,
    ].join('\n\n') + ideaLine(idea);
    return { mode, title: 'Competitor response brief', body, claimFlags: detectClaimFlags(idea ?? '') };
  }

  // diy-listing (default — what delights the DIY owner most)
  const body = [
    `TITLE: ${product} — speak to the outcome, not the molecule. Lead with what the customer feels when it works.`,
    `BULLET 1 (acknowledge): name ${objection} in their own words — "${snapshot.avatar?.howTheyTalk?.split('·')[0]?.trim() ?? 'their exact words'}". Make them feel understood before any spec.`,
    `BULLET 2 (why different): the one thing that makes you the answer to that, in one line.`,
    `BULLET 3 (proof): your strongest trust signal, stated specifically.`,
    `CTA: mirror their relief at finally solving it — not a description of the product.`,
  ].join('\n') + ideaLine(idea);
  return { mode, title: 'Listing copy (edit, don’t rewrite)', body, claimFlags: detectClaimFlags(`${body} ${idea ?? ''}`) };
}

/** Seed snapshot — InfinityVault (the demo brand): Empathetic gap → Recognition (Dove). */
export const SEED_SNAPSHOT: BrandSnapshot = {
  brand: 'InfinityVault',
  product: 'Premium 216-card trading-card binder',
  trustGap: {
    overall: 58,
    pillars: { insight: 19, distinctive: 15, empathetic: 9, authentic: 15 },
    primaryGap: 'empathetic',
  },
  avatar: {
    howTheyTalk: '“flimsy — I don’t trust it” · “bent my chase cards” · “finally one I actually trust”',
    whyBuyingToday: 'They just pulled a card worth more than the binder and realised their current storage won’t protect it.',
    trustSignals: 'Visible proof it physically protects — real materials, a guarantee, other collectors’ relief.',
    topObjection: 'They’ve been burned by a flimsy binder before, and assume yours is the same until you show them otherwise.',
  },
  evidence: ['flimsy — I don’t trust it with my chase cards', 'bent my cards the first week', 'finally one I actually trust'],
  ownerMode: 'diy-listing',
};
