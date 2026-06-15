/**
 * Layer 1 (service) — A/B test design (final owned chain link).
 *
 * Brand-coach OWNS test DESIGN (hypothesis, variants, metric, stopping rule);
 * IV-OS OWNS the durable test STORE (`record_test`/`get_test_result`, built +
 * Testing upstream — recording binds after D5). Pure composition, no network.
 */

export interface VariantInput {
  label?: string;
  content: string;
}

export interface TestDesignInput {
  name: string;
  variants: VariantInput[];
  hypothesis?: string;
  primary_metric?: string;
  channel?: string;
}

export interface ABVariantSpec {
  variant_id: string;
  label: string;
  content: string;
  traffic_share: number;
}

export interface ABTestSpec {
  name: string;
  hypothesis: string;
  channel?: string;
  primary_metric: string;
  variants: ABVariantSpec[];
  min_sample_per_variant: number;
  max_duration_days: number;
  success_criteria: string;
}

/** Default primary metric by channel family. */
const METRIC_BY_CHANNEL: Array<[RegExp, string]> = [
  [/amazon|listing|pdp|product/i, 'unit_session_percentage'],
  [/email/i, 'click_through_rate'],
  [/ad|ppc|sponsored/i, 'click_through_rate'],
  [/social|instagram|tiktok|x|twitter|facebook/i, 'engagement_rate'],
];

const DEFAULT_METRIC = 'conversion_rate';
const MIN_SAMPLE_PER_VARIANT = 1000; // sessions/impressions baseline heuristic
const MAX_DURATION_DAYS = 14;

export function designAbTest(input: TestDesignInput): ABTestSpec {
  if (input.variants.length < 2) {
    throw new Error('A/B test design requires at least 2 variants');
  }
  const metric =
    input.primary_metric ??
    METRIC_BY_CHANNEL.find(([re]) => input.channel && re.test(input.channel))?.[1] ??
    DEFAULT_METRIC;

  const share = Math.floor(10000 / input.variants.length) / 100;
  const variants: ABVariantSpec[] = input.variants.map((v, i) => ({
    variant_id: String.fromCharCode(65 + i), // A, B, C…
    label: v.label?.trim() || `Variant ${String.fromCharCode(65 + i)}`,
    content: v.content,
    traffic_share: share,
  }));

  return {
    name: input.name,
    hypothesis:
      input.hypothesis?.trim() ||
      `Variant B's angle outperforms Variant A on ${metric} for this audience.`,
    channel: input.channel,
    primary_metric: metric,
    variants,
    min_sample_per_variant: MIN_SAMPLE_PER_VARIANT,
    max_duration_days: MAX_DURATION_DAYS,
    success_criteria: `Declare a winner only if one variant beats the others on ${metric} with >= ${MIN_SAMPLE_PER_VARIANT} samples per variant (or stop at ${MAX_DURATION_DAYS} days and treat as inconclusive).`,
  };
}
