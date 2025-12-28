# Pricing & Subscription Documentation

This folder contains documentation for user-facing pricing, subscription tiers, and paywall implementation.

## Documents

### 💰 [Paywall Implementation Design](./PAYWALL_IMPLEMENTATION_DESIGN.md)
Complete design for the subscription paywall system, including:
- Tiered subscription model ($25/$50/$150 per month)
- $100 one-time setup fee
- Implementation flow and user journey
- Payment processing integration
- Feature access by tier

## Pricing Structure

### Current Model
- **Setup Fee**: $100 (one-time, all tiers)
- **Tier 1 - Basic**: $25/month
  - Core IDEA Framework access
  - Basic AI consultations
  - Document uploads (5 per month)

- **Tier 2 - Professional**: $50/month
  - Everything in Basic
  - Unlimited AI consultations
  - Document uploads (20 per month)
  - Brand canvas exports

- **Tier 3 - Premium**: $150/month
  - Everything in Professional
  - Unlimited document uploads
  - Priority AI processing
  - Custom brand strategy documents

## Implementation Status

- [ ] Stripe integration
- [ ] Subscription management UI
- [ ] Feature gating by tier
- [ ] Usage tracking and limits
- [ ] Billing portal

## Related Documentation

- [Cost Analysis](../costs/) - Infrastructure and operational costs
- [Feature Gating Guide](../FEATURE_GATING_GUIDE.md) - Technical implementation of feature access
- [Auth Implementation](../AUTH_IMPLEMENTATION.md) - Authentication flow with paywall

## Key Decisions

1. **Paywall Timing**: Presented after diagnostic, before account creation
2. **Trial Period**: No free trial (diagnostic serves as lead gen)
3. **Payment Processing**: Stripe for subscriptions and one-time fees
4. **Grandfathering**: Beta users maintain free access

---

*For infrastructure costs and analysis, see [Cost Documentation](../costs/)*