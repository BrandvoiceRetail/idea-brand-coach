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
  | 'llm_call_failed'
  // Corrective signal — the user disagreeing with / redoing AI output. The
  // highest-value feedback for improving extraction + generation quality.
  | 'field_review_accepted'
  | 'field_review_rejected'
  | 'field_review_accept_all'
  | 'field_review_abandoned'
  | 'signature_reconsidered'
  | 'signature_rerolled'
  // Caught React render errors (relayed from ErrorBoundary; complements
  // $exception autocapture, which only catches unhandled errors).
  | 'app_error_caught'
  // Coach answer quality — thumbs up/down on an assistant message. message_id
  // joins to chat_messages for the rated content.
  | 'coach_message_rated'
  // Feature adoption + failure — previously-dark merged features. Product
  // import (Amazon listings) and the onboarding tour.
  | 'product_import_started'
  | 'product_import_completed'
  | 'product_import_failed'
  | 'tour_started'
  | 'tour_completed'
  | 'tour_abandoned'
  // Figma integration — client-side capture of connect/import outcomes. The
  // `*_failed` events surface backend (edge-function) failures into PostHog
  // from the client, without an edge deploy.
  | 'figma_connect_started'
  | 'figma_connect_failed'
  | 'figma_disconnected'
  | 'figma_disconnect_failed'
  | 'figma_import_started'
  | 'figma_import_completed'
  | 'figma_import_failed'
  // Output engine (web app) — PDF/strategy export, and the research features.
  // `which` distinguishes brand_strategy_pdf vs competitor_pdf.
  | 'export_started'
  | 'export_completed'
  | 'export_failed'
  | 'buyer_intent_completed'
  | 'buyer_intent_failed'
  | 'competitive_analysis_started'
  | 'competitive_analysis_failed'
  // Remaining merged web features — failure capture (+ brand-copy completion).
  | 'brand_copy_completed'
  | 'brand_copy_failed'
  | 'contextual_help_failed'
  | 'ai_assist_failed'
  | 'document_upload_failed'
  // Brand Funnel Tracker — asset audit + fix + lift events.
  | 'funnel_asset_uploaded'
  | 'funnel_asset_audited'
  | 'funnel_fix_started'
  | 'funnel_test_recorded'
  | 'funnel_coverage_viewed'
  // User-perceived chat latency (TTFT + total). PostHog GeoIP gives per-country slicing.
  | 'chat_response_latency'
  // Competitor-Agents — per-touchpoint competitor analysis + Brand Defense.
  | 'funnel_competitor_analysis_run'
  | 'funnel_competitor_analysis_viewed'
  | 'funnel_competitor_countermeasure_drafted'
  | 'funnel_competitor_test_recorded'
  | 'funnel_defense_alerts_viewed'
  | 'funnel_defense_alert_read'
  // Avatar compare on the funnel (diagnostic overlay vs brand baseline).
  | 'scorecard_compared'
  // Signed-in forensic analysis (run-forensic-analysis): the long-running
  // post-signup value delivery. Run start + completion. Scores / asin-presence /
  // result shape only — never review text, listing copy, or PII.
  | 'forensic_analysis_started'
  | 'forensic_analysis_completed'
  // Problem-Solver /v2/diagnostic 8-screen flow — step advance through the
  // Diagnose → Unlock → Upload → Analyse → Customer → Fix → Stay-ahead → In-Claude
  // funnel. Step index + name + self-report score only — never PII or the ASIN value.
  | 'problem_solver_step_viewed'
  | 'problem_solver_unlock_gated';

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

/**
 * PostHog feature-flag key gating the MCP-first coach tool loop. Rollout is
 * managed in the PostHog UI (per-user / cohort / %); the edge fn AND-s this with
 * the `CONSULTANT_TOOL_LOOP_ENABLED` env kill-switch, so this is a rollout gate,
 * not a security boundary.
 */
export const COACH_TOOL_LOOP_FLAG = 'coach-mcp-tool-loop';

/**
 * Whether the MCP-first coach tool loop is active for this client.
 *
 * DEFAULT-ON by design: the loop is at 100% rollout and the authoritative
 * kill-switch is the server-side `CONSULTANT_TOOL_LOOP_ENABLED` env (AND-gated in
 * the edge fn). The client flag's only job is to force it OFF (flag disabled / 0%
 * rollout). So we disable ONLY on an explicit `false`; when PostHog is
 * unconfigured, errors, or its feature flags simply haven't loaded yet
 * (`isFeatureEnabled` → undefined — a real race that was silently dropping the
 * coach to single-shot), we stay ON. Rollback levers are intact: env=false (hard
 * kill) or set the flag to 0% / disabled (→ isFeatureEnabled returns false).
 */
export function isCoachToolLoopEnabled(): boolean {
  if (!isInitialized) return true;
  try {
    return posthog.isFeatureEnabled(COACH_TOOL_LOOP_FLAG) !== false;
  } catch (err) {
    console.warn('[posthogClient] feature flag check failed:', err);
    return true;
  }
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
