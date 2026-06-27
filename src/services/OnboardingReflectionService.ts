/**
 * OnboardingReflectionService — Layer-3 execution for the Loop-1 read-it-back run.
 *
 * Each method runs ONE real step and returns a `ReflectionStepResult` in the
 * no-fabrication shape (only `ok` carries a `finding`). Two kinds of step:
 *
 *  - DETERMINISTIC (read-back, avatar sketch): grounded in the user's OWN paste
 *    via `parseMegaprompt`. These echo the user's words; they never invent facts.
 *  - LIVE SEAM (Trust Gap): attempts the deployed `diagnostic-interpretation`
 *    edge fn. If the endpoint is unreachable or returns no score, it degrades to
 *    an honest `needs_input` — it NEVER fabricates a Trust Gap number.
 *
 * The edge invoke is injectable so tests drive the reachable / unreachable /
 * empty branches without a network.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  parseMegaprompt,
  portraitFromSlots,
  type ExtractedSlot,
} from '@/lib/v4/megapromptParse';
import type { ReflectionStepResult } from '@/types/onboardingReflection';

/** Injectable Trust-Gap invoker (defaults to the deployed edge fn). */
export type TrustGapInvoker = (
  evidence: string,
) => Promise<{ score: number; headline: string } | null>;

/** Default invoker: the deployed diagnostic-interpretation edge fn, defensively read. */
const defaultTrustGapInvoker: TrustGapInvoker = async (evidence) => {
  const { data, error } = await supabase.functions.invoke('diagnostic-interpretation', {
    body: { evidence },
  });
  if (error || !data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const score = typeof d.score === 'number' ? d.score : null;
  const headline =
    typeof d.headline === 'string'
      ? d.headline
      : typeof d.summary === 'string'
        ? d.summary
        : null;
  if (score == null || !headline) return null;
  return { score, headline };
};

export class OnboardingReflectionService {
  constructor(private readonly invokeTrustGap: TrustGapInvoker = defaultTrustGapInvoker) {}

  /**
   * Step 1 — "Reading it back". Pure, deterministic. RESTATES the brand back to
   * the user in their OWN words — a natural-language sentence built from the
   * verbatim slot *values* (never the field names, never invented). This is the
   * line the user confirms with "Sounds right / Not quite", so it must read like
   * a human reflection of what they wrote. `needs_input` when nothing usable
   * could be lifted from the paste.
   */
  readItBack(megaprompt: string, slots: readonly ExtractedSlot[]): ReflectionStepResult {
    if (slots.length === 0) {
      return {
        status: 'needs_input',
        needs_input: [
          {
            slot: 0,
            question: 'Tell me a bit more — what do you sell and who is it for?',
            why: "I couldn't pick out your product or customer from that yet.",
          },
        ],
      };
    }
    const by = (k: string): string | undefined => slots.find((s) => s.key === k)?.value;
    const brand = by('brand_name');
    let product = by('product');
    const customer = by('customer');
    let problem = by('problem');
    const channel = by('channel');
    const goal = by('goal');

    // Natural-language clauses nest, so the conservative probes overlap: the customer
    // clause ("busy parents who can't switch off at night") often contains the problem
    // fragment ("switch off at night"), and an over-broad product can swallow the
    // customer. Drop a value already conveyed by another so the restatement never repeats.
    const norm = (s?: string): string => (s ?? '').toLowerCase().trim();
    const contains = (a?: string, b?: string): boolean =>
      Boolean(a) && Boolean(b) && norm(a) !== norm(b) && norm(a).includes(norm(b));
    if (contains(customer, problem)) problem = undefined;
    if (contains(product, customer)) product = undefined;

    // Build a restatement from the user's verbatim words, in a natural order.
    const parts: string[] = [];
    if (brand && product) parts.push(`you're ${brand}, and you sell ${product}`);
    else if (brand) parts.push(`you're ${brand}`);
    else if (product) parts.push(`you sell ${product}`);
    if (customer) parts.push(`for ${customer}`);
    if (problem) parts.push(`to help with ${problem}`);
    if (channel) parts.push(`mainly on ${channel}`);
    if (goal) parts.push(`and you want to ${goal}`);

    // If the only thing we caught was a stray channel/goal (no brand/product/customer),
    // restate it plainly rather than forcing a sentence that reads oddly.
    const restatement =
      parts.length > 0
        ? parts.join(' ')
        : `you mentioned ${slots.map((s) => s.value).join(', ')}`;

    return {
      status: 'ok',
      finding: `Here's what I heard: ${restatement}.`,
    };
  }

  /**
   * Step 2 — "Trust Gap". Attempts the live diagnostic seam. Degrades to an
   * honest `needs_input` when unreachable or unscored — never a made-up score.
   */
  async runTrustGap(megaprompt: string): Promise<ReflectionStepResult> {
    try {
      const result = await this.invokeTrustGap(megaprompt);
      if (!result) {
        return {
          status: 'needs_input',
          needs_input: [
            {
              slot: 0,
              question:
                'To score your Trust Gap I need real evidence — your live listing URL or a batch of customer reviews.',
              why: 'I never score a brand on a paragraph alone; the number has to come from what buyers actually see and say.',
            },
          ],
        };
      }
      return {
        status: 'ok',
        finding: `Trust Gap ${result.score}/100 — ${result.headline}`,
      };
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Could not reach the Trust Gap engine.',
      };
    }
  }

  /**
   * Step 3 — "Avatar sketch". Restates a four-field portrait STRICTLY from the
   * extracted slots (the user's own words). `needs_input` when the paste lacks a
   * customer + problem to restate honestly.
   */
  sketchAvatar(slots: readonly ExtractedSlot[]): ReflectionStepResult {
    const portrait = portraitFromSlots(slots);
    if (!portrait) {
      return {
        status: 'needs_input',
        needs_input: [
          {
            slot: 0,
            question: 'Who is your customer, and what problem are you solving for them?',
            why: 'I only sketch an avatar from what you have told me — I will not invent your buyer.',
          },
        ],
      };
    }
    // The problem clause is often a fragment of the who clause (overlapping probes);
    // only append it when it adds something the who clause doesn't already say.
    const whoSaysProblem = portrait.who.toLowerCase().includes(portrait.problem.toLowerCase());
    const finding = whoSaysProblem
      ? `For ${portrait.who}.`
      : `For ${portrait.who} — struggling with ${portrait.problem}.`;
    return { status: 'ok', finding };
  }

  /** Convenience: the deterministic extraction shared by steps 1 + 3. */
  extract(megaprompt: string): ExtractedSlot[] {
    return parseMegaprompt(megaprompt);
  }
}
