/**
 * Server-side PostHog sink for Supabase edge functions.
 *
 * This is the "future PostHog edge sink" referenced in
 * `idea-framework-consultant-claude/telemetry.ts`: edge functions already emit
 * structured console logs (→ Supabase logs); this ALSO ships errors/events to
 * PostHog so backend failures land in the same UI as frontend `$exception`
 * (project 203641). It does not replace the console logs — it complements them.
 *
 * Safe no-op when `POSTHOG_API_KEY` is unset, so functions run unchanged in any
 * env. Fire-and-forget: never throws, never blocks the response.
 *
 * CONTENT DISCIPLINE (mirrors src/lib/posthogClient.ts + telemetry.ts): counts,
 * booleans, ids, status codes, error names only. Error messages are truncated;
 * never send prompts, message content, or PII.
 */

const POSTHOG_HOST = (Deno.env.get('POSTHOG_HOST') ?? 'https://eu.i.posthog.com').replace(/\/+$/, '');

// Project 203641 ingestion key. This is a PUBLISHABLE (write-only) PostHog
// project key — the same one shipped in the browser bundle, NOT a secret — so
// it's a safe fallback that activates the relay without a Supabase secret. Set
// the POSTHOG_API_KEY secret to override (e.g. to point at another project).
const FALLBACK_KEY = 'phc_uo6fGZgjmjnBRZTHsE4mQCAyFPfcvJLsQrE2CkDDnSDg';

/** Fire one PostHog event from the edge runtime. */
export function captureServerEvent(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {},
): void {
  const key = Deno.env.get('POSTHOG_API_KEY') ?? FALLBACK_KEY;
  if (!key) return;
  // fire-and-forget — telemetry must never break or slow the product
  void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, event, distinct_id: distinctId, properties }),
  }).catch(() => {});
}

/**
 * Report an edge-function error to PostHog Error Tracking (as a `$exception`)
 * so backend failures group in the same UI as frontend errors. `fn` is the
 * function slug; `context` carries safe scalars only (status_code, stage, …).
 */
export function captureServerException(
  fn: string,
  error: unknown,
  context: Record<string, unknown> = {},
  distinctId = `edge:${fn}`,
): void {
  const name = error instanceof Error ? error.name : 'EdgeError';
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  captureServerEvent('$exception', distinctId, {
    $exception_list: [{ type: name, value: message, mechanism: { handled: true, synthetic: false } }],
    $exception_type: name,
    $exception_message: message,
    edge_function: fn,
    ...context,
  });
}
