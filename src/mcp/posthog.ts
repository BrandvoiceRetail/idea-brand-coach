/**
 * Server-side PostHog client for the brand-coach MCP server.
 *
 * A singleton `posthog-node` instance shared across all tool handlers. The
 * MCP server is long-running (HTTP transport), so we use default batch mode —
 * do NOT set flushAt:1 / flushInterval:0 here.
 *
 * The client is a safe no-op when POSTHOG_API_KEY is unset, so the server
 * boots without analytics configured in local / test environments.
 *
 * Call `shutdownPostHog()` once on SIGINT / SIGTERM so the queue drains
 * before the process exits.
 */
import { PostHog } from 'posthog-node';

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (client !== null) return client;
  const key = process.env.POSTHOG_API_KEY;
  if (!key) return null;
  const opts: { host?: string; enableExceptionAutocapture: boolean } = {
    enableExceptionAutocapture: true,
  };
  if (process.env.POSTHOG_HOST) opts.host = process.env.POSTHOG_HOST;
  client = new PostHog(key, opts);
  return client;
}

/** Capture a single MCP server-side event. Safe no-op when PostHog is not configured. */
export function captureMcpEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
): void {
  try {
    getClient()?.capture({ distinctId, event, properties });
  } catch {
    // Analytics must never break the product.
  }
}

/** Capture an exception from an MCP tool or HTTP handler. Safe no-op when PostHog is not configured. */
export function captureMcpException(
  err: unknown,
  distinctId?: string,
  additionalProperties?: Record<string, string | number | boolean | null | undefined>,
): void {
  try {
    getClient()?.captureException(err, distinctId, additionalProperties);
  } catch {
    // Analytics must never break the product.
  }
}

/** Flush and shut down. Call once on process exit. */
export async function shutdownPostHog(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
