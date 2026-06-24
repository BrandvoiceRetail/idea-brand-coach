/**
 * Pure Stripe-webhook router (Step 4 of docs/PAYWALL_CREDIT_METERING_DESIGN.md).
 *
 * Deno-free + pure: classifies a VERIFIED Stripe event into an intent. No Stripe API call, no DB —
 * the edge fn verifies the signature, calls this, then the executor resolves the user (by Stripe
 * customer id) and runs the credit RPCs. Fully unit-testable.
 *
 * Grant policy: credits are granted on `invoice.paid` (fires for the first period AND every renewal),
 * idempotent on the event id. Subscription status/tier are maintained from `customer.subscription.*`.
 */
import { tierForPriceId, isInterval, isTier, type EnvGet, type Tier, type Interval } from './stripeConfig.ts';

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export type WebhookIntent =
  | {
      kind: 'grant';
      eventId: string;
      customerId: string;
      subscriptionId: string | null;
      credits: number;
      tier: Tier;
      interval: Interval;
      periodEnd: number | null; // unix seconds
    }
  | {
      kind: 'update_subscription';
      customerId: string;
      subscriptionId: string;
      status: string;
      cancelAtPeriodEnd: boolean;
      tier: Tier | null;
      interval: Interval | null;
      periodEnd: number | null;
    }
  | { kind: 'ignore'; reason: string };

function asString(x: unknown): string | null {
  return typeof x === 'string' && x ? x : null;
}

/** Pull a Stripe price id out of an invoice line / subscription item across API-version shapes. */
function priceIdFromLineOrItem(line: Record<string, unknown> | undefined): string | null {
  if (!line) return null;
  const price = line.price as { id?: string } | undefined;
  if (price?.id) return price.id;
  const plan = line.plan as { id?: string } | undefined;
  if (plan?.id) return plan.id;
  const pricing = line.pricing as { price_details?: { price?: string } } | undefined;
  if (pricing?.price_details?.price) return pricing.price_details.price;
  return null;
}

export function classifyEvent(event: StripeEventLike, env: EnvGet): WebhookIntent {
  const obj = event.data.object;

  switch (event.type) {
    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      const customerId = asString(obj.customer);
      if (!customerId) return { kind: 'ignore', reason: 'invoice without customer' };
      const lines = (obj.lines as { data?: Record<string, unknown>[] } | undefined)?.data ?? [];
      let priceId: string | null = null;
      let periodEnd: number | null = null;
      for (const line of lines) {
        priceId = priceIdFromLineOrItem(line);
        const period = line.period as { end?: number } | undefined;
        if (typeof period?.end === 'number') periodEnd = period.end;
        if (priceId) break;
      }
      if (!priceId) return { kind: 'ignore', reason: 'invoice line has no resolvable price' };
      const mapped = tierForPriceId(priceId, env);
      if (!mapped) return { kind: 'ignore', reason: `price ${priceId} is not a known tier` };
      return {
        kind: 'grant',
        eventId: event.id,
        customerId,
        subscriptionId: asString(obj.subscription),
        credits: mapped.credits,
        tier: mapped.tier,
        interval: mapped.interval,
        periodEnd,
      };
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const customerId = asString(obj.customer);
      const subscriptionId = asString(obj.id);
      if (!customerId || !subscriptionId) return { kind: 'ignore', reason: 'subscription without ids' };
      const status = event.type === 'customer.subscription.deleted'
        ? 'canceled'
        : (asString(obj.status) ?? 'active');
      const items = (obj.items as { data?: Record<string, unknown>[] } | undefined)?.data ?? [];
      const priceId = priceIdFromLineOrItem(items[0]);
      const mapped = priceId ? tierForPriceId(priceId, env) : null;
      const md = (obj.metadata as Record<string, unknown> | undefined) ?? {};
      const tier: Tier | null = mapped?.tier ?? (isTier(md.tier) ? md.tier : null);
      const interval: Interval | null = mapped?.interval ?? (isInterval(md.interval) ? md.interval : null);
      return {
        kind: 'update_subscription',
        customerId,
        subscriptionId,
        status,
        cancelAtPeriodEnd: obj.cancel_at_period_end === true,
        tier,
        interval,
        periodEnd: typeof obj.current_period_end === 'number' ? obj.current_period_end : null,
      };
    }

    default:
      return { kind: 'ignore', reason: `unhandled type ${event.type}` };
  }
}
