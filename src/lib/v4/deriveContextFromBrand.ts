/**
 * deriveContextFromBrand — bridge EXISTING Brand Coach data into the /v4
 * onboarding context so the surface never re-asks what the user already gave.
 *
 * The /v4 onboarding store has 6 ad-hoc slots (brand_name, product, customer,
 * problem, channel, goal) that were fed ONLY by the "tell me about your brand"
 * megaprompt — blind to the canonical avatar + the legacy BrandData. This maps
 * that existing data onto the slots so onboarding is pre-answered and the Analyse
 * gate (which needs customer + problem) passes for anyone who built an avatar.
 *
 * Rules: only return answers for slots that are still EMPTY (never overwrite the
 * user's own input); only emit a slot when REAL content exists (never fabricate);
 * tie the avatar-derived customer to a derivable problem so a skeleton/default
 * avatar (empty psychographics) yields NOTHING rather than junk like the literal
 * "Default Avatar". Marked confirm:true (stated) because the source is the user's
 * own confirmed avatar — that satisfies the gate without a redundant re-confirm.
 */
import type { Avatar } from '@/types/avatar';
import type { BrandData } from '@/contexts/BrandContext';
import type { V4Answer } from '@/contexts/V4ContextStore';

const clean = (s?: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** First non-empty list, joined as a readable phrase. */
const firstList = (...arrs: (readonly string[] | undefined)[]): string => {
  for (const a of arrs) {
    const joined = (a ?? []).map(clean).filter(Boolean).join(', ');
    if (joined) return joined;
  }
  return '';
};

export function deriveContextFromBrand(
  avatar: Avatar | null,
  brand: BrandData | null,
  emptyKeys: ReadonlySet<string>,
): V4Answer[] {
  const out: V4Answer[] = [];
  const add = (key: string, value: string): void => {
    const v = clean(value);
    if (v && emptyKeys.has(key)) out.push({ key, value: v, source: 'profile', confirm: true });
  };

  // ── From the canonical avatar (the customer + their pain) ──────────────────
  if (avatar) {
    const psy = avatar.psychographics ?? {};
    // "Problem" = the customer's pain; prefer fears, then desires, then the raw
    // voice-of-customer, then their decision factors.
    const problem =
      firstList(psy.fears, psy.desires) ||
      clean(avatar.voice_of_customer).slice(0, 160) ||
      firstList(avatar.buying_behavior?.decision_factors);

    // Only treat the avatar as "real" (vs a default skeleton) when a problem is
    // derivable — otherwise we'd emit a junk customer with no problem, which
    // wouldn't pass the gate anyway.
    if (problem) {
      add('problem', problem);
      const demo = avatar.demographics ?? {};
      const demoBits = [demo.age, demo.income, demo.location, demo.lifestyle]
        .map(clean)
        .filter(Boolean)
        .join(', ');
      const customer = clean(avatar.description) || [clean(avatar.name), demoBits].filter(Boolean).join(' — ');
      add('customer', customer);
    }
  }

  // ── From the legacy BrandData (opportunistic brand-level slots) ────────────
  if (brand) {
    add('brand_name', clean(brand.userInfo?.company));
    add('product', clean(brand.brandCanvas?.valueProposition) || clean(brand.distinctive?.uniqueValue));
    add('channel', firstList(brand.avatar?.preferredChannels));
    add('goal', firstList(brand.avatar?.goals) || clean(brand.brandCanvas?.brandMission));
  }

  return out;
}
