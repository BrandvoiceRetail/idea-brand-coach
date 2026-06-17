/**
 * PostHog client for Alpha instrumentation.
 *
 * Owns the funnel events (every step from landing to feedback), error events,
 * and the anonymous → authenticated identity thread. Initialised once from
 * App.tsx; every helper is a safe no-op when VITE_POSTHOG_KEY is unset, so
 * local dev without a key never breaks.
 *
 * CONTENT DISCIPLINE: event properties carry counts, booleans, IDs, and scores
 * ONLY. Review text, conversation content, and any PII must never pass through
 * here — rich content goes to Supabase `feedback_events` or nowhere.
 *
 * THE JOIN KEY: `getPostHogDistinctId()` is written into every
 * `feedback_events` row at submission time. It is what connects a tester's
 * PostHog funnel journey to their Supabase feedback. Non-optional.
 */

import posthog from 'posthog-js';

/** Every Alpha funnel + error event, snake_case, grouped by journey. */
export type AlphaEventName =
  | 'beta_welcome_viewed'
  | 'diagnostic_started'
  | 'diagnostic_completed'
  | 'scorecard_viewed'
  | 'scorecard_interpretation_shown'
  | 'auth_started'
  | 'auth_completed'
  | 'reviews_paste_shown'
  | 'reviews_pasted'
  | 'conversation_started'
  | 'conversation_message_sent'
  | 'signature_reveal_cta_shown'
  | 'signature_reveal_requested'
  | 'signature_options_shown'
  | 'signature_picked'
  | 'feedback_modal_opened'
  | 'feedback_submitted'
  | 'thank_you_viewed'
  | 'funnel_asset_uploaded'
  | 'funnel_asset_audited'
  | 'funnel_fix_started'
  | 'funnel_test_recorded'
  | 'funnel_coverage_viewed'
  // Competitor-Agents — per-touchpoint competitor analysis + Brand Defense.
  | 'funnel_competitor_analysis_run'
  | 'funnel_competitor_analysis_viewed'
  | 'funnel_competitor_countermeasure_drafted'
  | 'funnel_competitor_test_recorded'
  | 'funnel_defense_alerts_viewed'
  | 'funnel_defense_alert_read'
  | 'llm_call_failed';

/** Counts, booleans, IDs, scores only — never free text or PII. */
export type AlphaEventProps = Record<string, string | number | boolean | null | undefined>;

const FALLBACK_DISTINCT_ID_KEY = 'alpha_fallback_distinct_id';

let isInitialized = false;

/**
 * Initialise PostHog once. No-op (and logs nothing) when the key is unset so
 * the app works without analytics configured.
 */
export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key || isInitialized) return;

  posthog.init(key, {
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com',
    // Exception autocapture — the Alpha error-monitoring surface (no Sentry).
    capture_exceptions: true,
  });
  isInitialized = true;
}

export function isPostHogEnabled(): boolean {
  return isInitialized;
}

/** Fire one Alpha funnel/error event. Safe no-op when PostHog is disabled. */
export function captureAlphaEvent(name: AlphaEventName, properties?: AlphaEventProps): void {
  if (!isInitialized) return;
  try {
    posthog.capture(name, properties);
  } catch (err) {
    // Analytics must never break the product.
    console.warn('[posthogClient] capture failed:', err);
  }
}

/**
 * Merge the anonymous journey into the identified person. Called at the auth
 * point (AuthProvider) — PostHog aliases the anonymous distinct_id to the
 * user, so pre-auth diagnostic events and post-auth coach events read as one
 * person. Idempotent.
 */
export function identifyUser(userId: string): void {
  if (!isInitialized) return;
  try {
    posthog.identify(userId);
  } catch (err) {
    console.warn('[posthogClient] identify failed:', err);
  }
}

/** Drop identity on sign-out so the next tester on this device starts fresh. */
export function resetIdentity(): void {
  if (!isInitialized) return;
  try {
    posthog.reset();
  } catch (err) {
    console.warn('[posthogClient] reset failed:', err);
  }
}

/**
 * THE JOIN KEY. Returns the PostHog distinct_id that threads this tester's
 * funnel events; it must be written into every `feedback_events` row.
 *
 * If PostHog is not configured (no env key), falls back to a locally-persisted
 * id so feedback is never lost — same-device submissions still thread together
 * even though there is no PostHog journey to join against.
 */
export function getPostHogDistinctId(): string {
  if (isInitialized) {
    try {
      const id = posthog.get_distinct_id();
      if (id) return id;
    } catch {
      // fall through to the local fallback
    }
  }
  try {
    let fallback = localStorage.getItem(FALLBACK_DISTINCT_ID_KEY);
    if (!fallback) {
      fallback = `fallback:${crypto.randomUUID()}`;
      localStorage.setItem(FALLBACK_DISTINCT_ID_KEY, fallback);
    }
    return fallback;
  } catch {
    return `fallback:${crypto.randomUUID()}`;
  }
}
