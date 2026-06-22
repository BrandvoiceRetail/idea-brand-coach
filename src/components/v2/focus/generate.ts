/**
 * Live deliverable generation — the impure adapter the focus surface calls to PRODUCE.
 *
 * For copy-shaped modes it calls the deployed, Claude-backed `brand-copy-generator` edge fn
 * (which auto-pulls the owner's brand context from their knowledge base and is credit-metered),
 * grounded by the focus's trigger + evidence + the owner's steer. The deterministic
 * `composeDeliverable` is the graceful fallback — on any error, gate, or missing copy we return
 * the (still brand-specific, instant, free) template so the owner is never blocked.
 *
 * Engine stays pure; this is the only focus module that touches the network.
 */
import { supabase } from '@/integrations/supabase/client';
import { composeDeliverable, detectClaimFlags, type ComposeInput } from './engine';
import type { Deliverable, DeliverableMode } from './types';

/** Focus mode → the brand-copy-generator format that best fits it. Modes absent here stay deterministic. */
const COPY_FORMAT: Partial<Record<DeliverableMode, string>> = {
  'diy-listing': 'amazon-bullet',
  'designer-brief': 'landing-hero',
  competitor: 'pdp-description',
};

export interface GenerateResult {
  deliverable: Deliverable;
  /** true = AI-generated for this brand; false = deterministic template fallback. */
  live: boolean;
}

function additionalContext(input: ComposeInput): string {
  const { focus, snapshot, idea } = input;
  return [
    `This is the single highest-leverage fix right now. ${focus.why}`,
    focus.trigger ? `Lead with the ${focus.trigger} angle (like ${focus.anchor}). Mirror the customer before you present proof.` : '',
    snapshot.avatar?.topObjection ? `Overcome this top objection: ${snapshot.avatar.topObjection}` : '',
    focus.evidence.length ? `Use the customer's own words where you can: ${focus.evidence.map((e) => `"${e}"`).join('; ')}` : '',
    'Do not invent reviews, stats, or claims. Keep it specific to this brand.',
    idea?.trim() ? `The owner's steer: ${idea.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Produce a deliverable for the current focus + mode. Tries live AI generation for copy modes,
 * falls back to the deterministic composer. Never throws.
 */
export async function generateDeliverable(input: ComposeInput): Promise<GenerateResult> {
  const fallback = composeDeliverable(input); // always valid, brand-specific, instant
  const format = COPY_FORMAT[input.mode];
  if (!format) return { deliverable: fallback, live: false };

  try {
    const { focus, snapshot } = input;
    const { data, error } = await supabase.functions.invoke('brand-copy-generator', {
      body: {
        productName: snapshot.product || snapshot.brand,
        category: 'ecommerce',
        features: [],
        targetAudience: snapshot.avatar?.whyBuyingToday || 'your customer at their moment of need',
        emotionalPayoff: focus.trigger ? `${focus.trigger} — ${focus.why}` : focus.why,
        tone: 'warm but credible, never hypey; UK English',
        format,
        additionalContext: additionalContext(input),
      },
    });
    const copy = (data as { copy?: string } | null)?.copy?.trim();
    if (error || !copy) return { deliverable: fallback, live: false };
    // Keep the deterministic brief's extras (e.g. the designer image prompt); swap in the AI copy.
    return {
      deliverable: { ...fallback, body: copy, claimFlags: detectClaimFlags(copy) },
      live: true,
    };
  } catch {
    return { deliverable: fallback, live: false };
  }
}
