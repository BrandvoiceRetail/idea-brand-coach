/**
 * Pure helpers for the post-OAuth `?canva=` return parameters.
 *
 * After the `canva-oauth-callback` edge function redirects the browser back to
 * the app, the URL carries `?canva=connected` or `?canva=error&reason=<slug>`.
 * The Integrations page reads these, fires a toast, then strips them. Extracting
 * the parse + message + strip logic here keeps it unit-testable without a DOM.
 */

export type CanvaReturnStatus = 'connected' | 'error';

export interface CanvaReturnResult {
  /** Parsed status, or null when no `canva` param is present. */
  status: CanvaReturnStatus | null;
  /** Optional error slug (only meaningful when status === 'error'). */
  reason: string | null;
  /** The search string with the canva params removed (leading '?' or ''). */
  cleanedSearch: string;
}

/** Toast variant the caller should fire for a given return result. */
export interface CanvaReturnToast {
  type: 'success' | 'error';
  message: string;
}

/**
 * Parse the `canva` return params out of a URL search string and return the
 * search string with those params (and `reason`) removed.
 *
 * @param search e.g. `?canva=error&reason=origin_not_allowed&foo=bar`
 */
export function parseCanvaReturn(search: string): CanvaReturnResult {
  const params = new URLSearchParams(search);
  const raw = params.get('canva');

  const status: CanvaReturnStatus | null =
    raw === 'connected' || raw === 'error' ? raw : null;
  const reason = status === 'error' ? params.get('reason') : null;

  // Always strip the canva-specific params so a refresh doesn't re-toast.
  params.delete('canva');
  params.delete('reason');

  const remaining = params.toString();
  const cleanedSearch = remaining ? `?${remaining}` : '';

  return { status, reason, cleanedSearch };
}

/** Human-readable, non-technical messages keyed by error slug. */
const REASON_MESSAGES: Record<string, string> = {
  origin_not_allowed:
    "We couldn't verify where the request came from. Please try connecting again.",
  access_denied: 'Canva access was declined. You can try connecting again any time.',
  invalid_state: 'Your Canva sign-in link expired. Please start the connection again.',
  token_exchange_failed:
    "We couldn't finish connecting to Canva. Please try again in a moment.",
};

/**
 * Map a parsed return result to the toast the page should fire, or null when
 * there's nothing to announce.
 */
export function getCanvaReturnToast(result: CanvaReturnResult): CanvaReturnToast | null {
  if (result.status === 'connected') {
    return { type: 'success', message: 'Canva connected. Your designs are ready to browse.' };
  }
  if (result.status === 'error') {
    const message =
      (result.reason && REASON_MESSAGES[result.reason]) ||
      "We couldn't connect to Canva. Please try again.";
    return { type: 'error', message };
  }
  return null;
}
