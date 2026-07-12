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

import { hasAnalyticsConsent, onConsentChange } from './consent';

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
  // Content generation (Pixii images / Claude copy) per funnel piece.
  | 'funnel_content_generated'
  | 'funnel_content_saved'
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
  // Forensic AVATAR build (useForensicAvatarBuild — the 4-stage s1–s4 pipeline,
  // the primary v2 avatar-creation path). Start / completion / failure. Stage +
  // booleans only, never extracted content.
  | 'forensic_build_started'
  | 'forensic_build_completed'
  | 'forensic_build_failed'
  // Problem-Solver /v2/diagnostic 8-screen flow — step advance through the
  // Diagnose → Unlock → Upload → Analyse → Customer → Fix → Stay-ahead → In-Claude
  // funnel. Step index + name + self-report score only — never PII or the ASIN value.
  | 'problem_solver_step_viewed'
  | 'problem_solver_unlock_gated'
  // /v4 surface — the Diagnose → Analyse → Fix → Re-measure → Defend spine.
  // Page-level (stage viewed / gate blocked / advanced) + per-screen funnel
  // events. Registered here so the compiler guards every emitted name (no casts).
  // Post-signup onboarding CHOICE screen — which path the user takes from the
  // fork (connector = primary/recommended, in-app megaprompt = secondary).
  | 'v4_onboard_choice_viewed'
  | 'v4_onboard_choice_connector'
  | 'v4_onboard_choice_in_app'
  // Connector-setup guide — add the Brand Coach connector in Claude/ChatGPT +
  // Windsor + the two pasteable prompts. Copy outcomes carry a `target`/`case`
  // slug only, never the copied text; `done` fires on advance to the funnel.
  | 'v4_connector_setup_viewed'
  | 'v4_connector_url_copied'
  | 'v4_connector_prompt_copied'
  | 'v4_connector_setup_done'
  | 'v4_onboarding_stage_viewed'
  | 'v4_onboarding_read_back_started'
  // Loop-1 inline gap-fill — the user answers a genuinely-empty context slot.
  | 'v4_onboarding_gap_answered'
  | 'v4_onboarding_findings_confirmed'
  | 'v4_onboarding_findings_edited'
  | 'v4_onboarding_advanced_to_diagnose'
  | 'v4_diagnose_run_diagnostic_clicked'
  | 'v4_diagnose_stage_viewed'
  // Already-diagnosed recap: a returning/MCP-onboarded user with a saved Trust Gap
  // is offered "Continue to Fix" instead of restarting the diagnostic.
  | 'v4_diagnose_already_done'
  | 'v4_diagnose_skip_to_fix'
  | 'v4_diagnose_rerun'
  | 'v4_analyse_stage_viewed'
  | 'v4_analyse_gate_blocked'
  | 'v4_analyse_advanced_to_fix'
  | 'v4_analyse_run_started'
  | 'v4_analyse_run_completed'
  | 'v4_analyse_run_failed'
  | 'v4_analyse_step_completed'
  | 'v4_avatar_profile_field_edited'
  | 'v4_avatar_profile_confirmed'
  | 'v4_decision_trigger_viewed'
  | 'v4_decision_board_moves_shown'
  | 'v4_decision_board_move_selected'
  | 'v4_brief_claim_gate_viewed'
  | 'v4_brief_claim_confirmed'
  | 'v4_brief_exported'
  | 'v4_fix_stage_viewed'
  | 'v4_fix_gate_blocked'
  | 'v4_fix_advanced_to_remeasure'
  // Re-audit an existing piece from a fresh screenshot (per-avatar overlay).
  | 'v4_piece_reaudit_submitted'
  | 'v4_piece_reaudit_succeeded'
  | 'v4_piece_reaudit_failed'
  // Free-trial gate: a non-member hit the one-piece limit / clicked the upgrade CTA.
  | 'v4_trial_limit_hit'
  | 'v4_upgrade_cta_clicked'
  // Stripe checkout: the user picked a tier and we started a Checkout session.
  | 'checkout_started'
  // Loop-3 Fix sub-view navigation (funnel map ↔ piece detail ↔ fix & test ↔
  // testing & lift). The `view` slug only — no copy/PII.
  | 'v4_fix_view_changed'
  | 'v4_fix_drift_banner_shown'
  | 'v4_fix_test_viewed'
  | 'v4_fix_rewrite_requested'
  | 'v4_fix_variant_claim_confirmed'
  | 'v4_fix_test_opened'
  | 'v4_fix_coach_opened'
  // Add-a-piece dialog (Upload screen ①) — open the dialog, submit, and the
  // grounded add+audit outcome. Counts/IDs/booleans only (touchpoint, stage,
  // channel, content_mode) — never the pasted copy or the job line.
  | 'v4_add_piece_opened'
  | 'v4_add_piece_submitted'
  | 'v4_add_piece_succeeded'
  | 'v4_add_piece_failed'
  | 'v4_funnel_map_viewed'
  | 'v4_funnel_map_retry'
  | 'v4_funnel_asset_opened'
  // Funnel-by-Job map toolbar actions — add a piece and channel-chip filtering.
  // Counts / channel slug / on-off flag only.
  | 'v4_funnel_add_piece_clicked'
  | 'v4_funnel_channel_filtered'
  // Funnel-by-Job map toolbar scoping controls — avatar / marketplace / range.
  // ids + slugs only (never names or metric values).
  | 'v4_funnel_avatar_changed'
  | 'v4_funnel_marketplace_changed'
  | 'v4_funnel_range_changed'
  | 'v4_what_needs_work_viewed'
  | 'v4_testing_lift_viewed'
  | 'v4_testing_lift_filtered'
  | 'v4_testing_lift_exported'
  // Experiment-lifecycle milestone stamps on a test row (ASSET_CREATED / ASSET_LIVE).
  // `milestone` slug only — never the test name or any copy.
  | 'v4_test_lifecycle_advanced'
  | 'v4_asset_detail_tab_viewed'
  | 'v4_asset_check_run'
  | 'v4_asset_verdict_recorded'
  // Funnel-by-Job piece detail ("did this piece do its job?") — open + the
  // metric→fix actions. Counts / ids / verdict only, never stored copy or PII.
  | 'v4_funnel_piece_viewed'
  | 'v4_funnel_piece_update_stored_clicked'
  | 'v4_funnel_piece_brief_clicked'
  | 'v4_funnel_piece_test_clicked'
  | 'v4_funnel_piece_check_clicked'
  | 'v4_remeasure_stage_viewed'
  | 'v4_remeasure_gate_blocked'
  | 'v4_remeasure_advanced_to_defend'
  | 'v4_trust_gap_lift_viewed'
  | 'v4_business_metrics_viewed'
  // Re-measure experiment before/after lift card — list view + the won/no-lift
  // verdict stamp. `status`/`stage`/`verdict` slugs + counts only, never copy.
  | 'v4_experiment_lift_viewed'
  | 'v4_experiment_result_marked'
  | 'v4_defend_stage_viewed'
  | 'v4_defend_gate_blocked'
  | 'v4_defend_workbook_requested'
  | 'v4_defend_workbook_result'
  | 'v4_defend_loop_restarted'
  | 'v4_defend_drift_watch_viewed'
  | 'v4_defend_checklist_viewed'
  | 'v4_defend_competitor_teaser_viewed'
  // /v5 alpha — the Avatar 2.0 build theatre (ASIN → live build → co-sign →
  // Trust Gap + Decision Trigger → design brief → save). Counts / booleans /
  // slugs only — never review text, listing copy, the ASIN value, or PII.
  | 'v5_entry_viewed'
  | 'v5_run_started'
  | 'v5_corpus_ready'
  | 'v5_corpus_retry'
  | 'v5_stage_revealed'
  | 'v5_cosign_confirmed'
  | 'v5_results_viewed'
  | 'v5_brief_viewed'
  | 'v5_brief_shared'
  | 'v5_saved'
  | 'v5_coldstart_shown'
  | 'v5_express_run'
  // Returning-user home (V5Home) — the signed-in landing that lists the
  // listings a seller has already analysed. Home viewed + re-open one in
  // express. Counts / booleans / IDs only, never the ASIN value or PII.
  | 'v5_home_viewed'
  | 'v5_home_reopen'
  // Persisted last-run brief opened instantly from the home screen (no re-run).
  | 'v5_brief_reopened';

/** Counts, booleans, IDs, scores only — never free text or PII. */
export type AlphaEventProps = Record<string, string | number | boolean | null | undefined>;

const FALLBACK_DISTINCT_ID_KEY = 'alpha_fallback_distinct_id';

let isInitialized = false;

/**
 * Initialise PostHog once. No-op (and logs nothing) when the key is unset so
 * the app works without analytics configured.
 *
 * CONSENT-GATED (GDPR/ePrivacy): refuses to start without a stored analytics
 * opt-in — before the visitor decides, no PostHog cookies exist and no events
 * leave the browser. Wire-up happens via bindAnalyticsToConsent() in App.tsx.
 */
export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key || isInitialized || !hasAnalyticsConsent()) return;

  posthog.init(key, {
    // EU host pinned as the CODE default — a worktree build missing .env must
    // never silently ship US ingestion (GDPR transfer record says EU).
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://eu.i.posthog.com',
    // Exception autocapture — the Alpha error-monitoring surface (no Sentry).
    capture_exceptions: true,
  });
  isInitialized = true;
}

/**
 * Bind analytics to the consent store: start PostHog if consent is already
 * granted, start/opt-in on a later grant, and opt out + drop identity when
 * consent is withdrawn. Call once at app boot (replaces a bare initPostHog()).
 */
export function bindAnalyticsToConsent(): void {
  initPostHog();
  onConsentChange((state) => {
    if (state.analytics === 'granted') {
      if (isInitialized) {
        try {
          posthog.opt_in_capturing();
        } catch (err) {
          console.warn('[posthogClient] opt-in failed:', err);
        }
      } else {
        initPostHog();
      }
    } else if (isInitialized) {
      try {
        // Stop capture and drop the device's identity/super-properties so a
        // withdrawal behaves like erasure on this device (Art. 7(3) — as easy
        // to withdraw as to give).
        posthog.opt_out_capturing();
        posthog.reset();
      } catch (err) {
        console.warn('[posthogClient] opt-out failed:', err);
      }
    }
  });
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
