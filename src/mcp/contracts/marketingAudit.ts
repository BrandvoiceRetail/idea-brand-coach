/**
 * Contract — `marketing_audit` (gold Workbook B, sheet "Investment Matrix").
 *
 * §3: a memory-powered calibration of a static move library (#17 FRAMEWORK). Tier
 * assignment + applicability come from BUSINESS-FACT slots (brand-asset/channel
 * states); cash/hours/effort are library defaults adjusted by business size; the
 * 1/3/6/12-mo benefit ranges are LABELED ESTIMATES calibrated by revenue/margin/ad
 * metrics (gold renders ranges like "+$200–500"). Benefit fields are free-text band
 * strings (not numerics) so the engine cannot emit a fabricated exact figure and to
 * preserve gold's mixed cells ("Saves ~$168 + recovers margin", "Velocity bump").
 *
 * Schema covers gold "Investment Matrix" columns: Tier, Investment, What it is,
 * Calendar time, Person-hours, Level of effort, Cash cost, 1/3/6/12-mo benefit.
 */
import { z } from 'zod';
import type { ArtifactContract } from './types.js';
import { groundingEnvelope } from './grounding.js';

/** "Tier" — T1 do-first / T2 queue / T3 defer. */
export const investmentTierSchema = z.enum(['T1', 'T2', 'T3']);
export type InvestmentTier = z.infer<typeof investmentTierSchema>;

export const investmentRowSchema = z.object({
  tier: investmentTierSchema,
  /** "Investment" — the move name. */
  investment: z.string().min(1),
  /** "What it is" — the move description. */
  what_it_is: z.string().min(1),
  /** "Calendar time". */
  calendar_time: z.string().min(1),
  /** "Person-hours". */
  person_hours: z.string().min(1),
  /** "Level of effort". */
  level_of_effort: z.string().min(1),
  /** "Cash cost". */
  cash_cost: z.string().min(1),
  /** "1-mo benefit" — labeled estimate band (free text). */
  benefit_1mo: z.string().min(1),
  /** "3-mo benefit". */
  benefit_3mo: z.string().min(1),
  /** "6-mo benefit". */
  benefit_6mo: z.string().min(1),
  /** "12-mo benefit". */
  benefit_12mo: z.string().min(1),
});
export type InvestmentRow = z.infer<typeof investmentRowSchema>;

export const marketingAuditOutputSchema = z.object({
  rows: z.array(investmentRowSchema).min(1),
  ...groundingEnvelope,
});
export type MarketingAuditOutput = z.infer<typeof marketingAuditOutputSchema>;

const kind = 'marketing_audit' as const;

/**
 * §3: move library (#17 FRAMEWORK) calibrated by brand-asset states (#7), revenue/
 * margin/ad metrics (#8), channel states (#10), inventory risks (#11), competitor
 * set/prices (#16), and product catalog (#5) for SKU-specific moves.
 */
const requiredContext = [17, 7, 8, 10, 11, 16, 5] as const;

export const marketingAuditContract: ArtifactContract<typeof marketingAuditOutputSchema> = {
  kind,
  outputSchema: marketingAuditOutputSchema,
  requiredContext,
};
