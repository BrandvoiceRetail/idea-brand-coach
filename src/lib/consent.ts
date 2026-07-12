/**
 * Consent store — the client-side source of truth for privacy consent
 * (GDPR Art. 6(1)(a) / ePrivacy). Analytics (PostHog) may only start after an
 * explicit opt-in recorded here; "no decision yet" means NO tracking.
 *
 * State lives in localStorage so anonymous visitors keep their choice across
 * visits. Signed-in users additionally get a durable `user_consents` row via
 * consentService (Art. 7(1) demonstrability) — this module stays storage-only
 * so it can be imported anywhere (including posthogClient) without cycles.
 */

export type ConsentDecision = 'granted' | 'denied';

export interface ConsentState {
  analytics: ConsentDecision;
  /** Version of the privacy notice the decision was made against. */
  policyVersion: string;
  /** ISO timestamp of the decision. */
  decidedAt: string;
}

/**
 * Bump when the privacy notice changes materially — stored decisions made
 * against an older version are discarded, so the banner re-prompts.
 */
export const CONSENT_POLICY_VERSION = '2026-07-08';

const STORAGE_KEY = 'idea.consent.v1';

type ConsentListener = (state: ConsentState) => void;
const listeners = new Set<ConsentListener>();

/** The stored decision, or null when the visitor has not decided yet. */
export function getStoredConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.analytics !== 'granted' && parsed.analytics !== 'denied') return null;
    if (parsed.policyVersion !== CONSENT_POLICY_VERSION) return null;
    return parsed as ConsentState;
  } catch {
    return null;
  }
}

/** Persist a decision and notify subscribers (e.g. the analytics binding). */
export function setStoredConsent(analytics: ConsentDecision): ConsentState {
  const state: ConsentState = {
    analytics,
    policyVersion: CONSENT_POLICY_VERSION,
    decidedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private-mode/storage failures must never block the choice taking effect
    // for this page view; subscribers still get notified below.
  }
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (err) {
      console.warn('[consent] listener failed:', err);
    }
  });
  return state;
}

export function hasAnalyticsConsent(): boolean {
  return getStoredConsent()?.analytics === 'granted';
}

/** Subscribe to consent changes. Returns an unsubscribe function. */
export function onConsentChange(listener: ConsentListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
