/**
 * PostHog Logs — Next.js instrumentation, per PostHog's "Integrate with Next.js"
 * logs guide. Next.js loads `instrumentation.ts` at startup and calls `register()`.
 *
 * ⚠️ CONTEXT: this repository is a Vite/React SPA with a Node MCP server — it does
 * NOT run Next.js, so no runtime calls `register()` and this file is inert here.
 * It exists to mirror PostHog's documented Next.js setup. The LIVE, verified
 * PostHog-logs integration for this codebase is the Node MCP server's
 * `src/mcp/instrumentation.ts` (wired from `src/mcp/index.ts`).
 *
 * Endpoint note: PostHog's logs OTLP path is `/i/v1/logs` — the `/otlp/v1/logs`
 * URL shown in some onboarding snippets returns 404. Token is the project key
 * (read from env here; falls back to the documented project token).
 */
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';

export function register(): void {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const exporter = new OTLPLogExporter({
      url: 'https://eu.i.posthog.com/i/v1/logs',
      headers: {
        Authorization: `Bearer ${process.env.POSTHOG_API_KEY ?? 'phc_uo6fGZgjmjnBRZTHsE4mQCAyFPfcvJLsQrE2CkDDnSDg'}`,
      },
    });

    // sdk-logs >=0.2xx takes processors via the constructor (the older
    // `addLogRecordProcessor()` shown in some snippets was removed).
    const loggerProvider = new LoggerProvider({
      resource: resourceFromAttributes({ 'service.name': 'idea-brand-coach' }),
      processors: [new SimpleLogRecordProcessor(exporter)],
    });

    // Make the logger available globally (per the PostHog Next.js guide).
    (globalThis as unknown as { __posthogLogger?: unknown }).__posthogLogger =
      loggerProvider.getLogger('idea-brand-coach');
  }
}
