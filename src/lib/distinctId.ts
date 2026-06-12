/**
 * THE JOIN KEY (lite). The save-feedback-event edge fn (v3) requires a
 * posthogDistinctId on every write — it threads a tester's feedback rows to
 * their PostHog funnel events.
 *
 * This lineage does not bundle posthog-js (the full client lives on
 * feat/alpha-instrumentation as src/lib/posthogClient.ts — prefer it and delete
 * this file when the branches merge). Semantics match that client exactly:
 * use a window-level PostHog instance when one exists, otherwise fall back to
 * a locally-persisted id under the SAME storage key, so same-device ids thread
 * across the merge.
 */

const FALLBACK_DISTINCT_ID_KEY = 'alpha_fallback_distinct_id';

interface WindowPostHog {
  get_distinct_id?: () => string;
}

export function getPostHogDistinctId(): string {
  const globalPosthog = (window as { posthog?: WindowPostHog }).posthog;
  if (globalPosthog?.get_distinct_id) {
    try {
      const id = globalPosthog.get_distinct_id();
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
