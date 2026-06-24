import { describe, it, expect } from 'vitest';
import { classifyEvent, type StripeEventLike } from '../stripeWebhook';
import type { EnvGet } from '../stripeConfig';

const env: EnvGet = (k) => (({
  STRIPE_PRICE_PRO_MONTH: 'price_pro_m',
  STRIPE_PRICE_SCALE_MONTH: 'price_scale_m',
} as Record<string, string>)[k]);

const ev = (type: string, object: Record<string, unknown>, id = 'evt_1'): StripeEventLike =>
  ({ id, type, data: { object } });

describe('classifyEvent — invoice.paid (grant)', () => {
  it('maps the invoice line price to a credit grant', () => {
    const intent = classifyEvent(ev('invoice.paid', {
      customer: 'cus_1',
      subscription: 'sub_1',
      lines: { data: [{ price: { id: 'price_pro_m' }, period: { end: 1234 } }] },
    }), env);
    expect(intent).toEqual({
      kind: 'grant', eventId: 'evt_1', customerId: 'cus_1', subscriptionId: 'sub_1',
      credits: 6000, tier: 'pro', interval: 'month', periodEnd: 1234,
    });
  });

  it('ignores an invoice with no customer', () => {
    const intent = classifyEvent(ev('invoice.paid', { lines: { data: [] } }), env);
    expect(intent).toEqual({ kind: 'ignore', reason: 'invoice without customer' });
  });

  it('ignores an invoice whose price is not a known tier', () => {
    const intent = classifyEvent(ev('invoice.paid', {
      customer: 'cus_1', lines: { data: [{ price: { id: 'price_unknown' } }] },
    }), env);
    expect(intent.kind).toBe('ignore');
  });
});

describe('classifyEvent — customer.subscription.* (status)', () => {
  it('updates status/tier/interval/periodEnd from the subscription object', () => {
    const intent = classifyEvent(ev('customer.subscription.updated', {
      id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: false,
      current_period_end: 9999, items: { data: [{ price: { id: 'price_scale_m' } }] },
    }), env);
    expect(intent).toEqual({
      kind: 'update_subscription', customerId: 'cus_1', subscriptionId: 'sub_1', status: 'active',
      cancelAtPeriodEnd: false, tier: 'scale', interval: 'month', periodEnd: 9999,
    });
  });

  it('marks a deleted subscription canceled', () => {
    const intent = classifyEvent(ev('customer.subscription.deleted', {
      id: 'sub_1', customer: 'cus_1', status: 'active', items: { data: [] },
    }), env);
    expect(intent).toMatchObject({ kind: 'update_subscription', status: 'canceled' });
  });

  it('reads cancel_at_period_end through to the intent', () => {
    const intent = classifyEvent(ev('customer.subscription.updated', {
      id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: true, items: { data: [] },
      metadata: { tier: 'pro', interval: 'month' },
    }), env);
    expect(intent).toMatchObject({ kind: 'update_subscription', cancelAtPeriodEnd: true, tier: 'pro' });
  });
});

describe('classifyEvent — other', () => {
  it('ignores unhandled event types', () => {
    expect(classifyEvent(ev('payment_intent.succeeded', {}), env)).toEqual({
      kind: 'ignore', reason: 'unhandled type payment_intent.succeeded',
    });
  });
});
