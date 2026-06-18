/**
 * OpenTelemetry → PostHog Logs for the brand-coach MCP server.
 *
 * PostHog's Logs product ingests over the standard OTLP/HTTP logs endpoint —
 * no PostHog-specific package. We stand up one `LoggerProvider` at server
 * startup (wired from `index.ts` — the Node equivalent of Next.js's
 * `instrumentation.ts` `register()`, which doesn't apply to this Node service)
 * and expose `emitLog()` for handlers.
 *
 * Reuses the same project as the server-side analytics client (`posthog.ts`):
 * `POSTHOG_API_KEY` (the project key) + `POSTHOG_HOST` (EU). Safe no-op when
 * the key is unset, so the server boots without logging configured.
 *
 * CONTENT DISCIPLINE (MF-5, see folder AGENTS.md): log bodies are static
 * strings and attributes carry counts / booleans / IDs / names ONLY — never
 * PII, prompts, tokens, or tool args. Same bar as `safeLog` / `posthog.ts`.
 *
 * Drain `shutdownOtelLogs()` on SIGINT/SIGTERM so buffered records flush
 * before exit (mirrors `shutdownPostHog()`).
 */
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { SeverityNumber, type Logger, type LogAttributes } from '@opentelemetry/api-logs';

const SERVICE_NAME = 'brand-coach-mcp';

let provider: LoggerProvider | null = null;
let logger: Logger | null = null;

/**
 * Initialise the OTLP → PostHog logs pipeline once. No-op (and emits nothing)
 * when `POSTHOG_API_KEY` is unset, so local / test runs never break.
 */
export function initOtelLogs(): void {
  if (provider || !process.env.POSTHOG_API_KEY) return;

  // PostHog Logs ingests OTLP/HTTP at `/i/v1/logs` (NOT the generic
  // `/otlp/v1/logs` some snippets show — that 404s). Host = same EU/US
  // ingestion host as events; token = the project key.
  const host = (process.env.POSTHOG_HOST ?? 'https://eu.i.posthog.com').replace(/\/+$/, '');
  const exporter = new OTLPLogExporter({
    url: `${host}/i/v1/logs`,
    headers: { Authorization: `Bearer ${process.env.POSTHOG_API_KEY}` },
  });

  provider = new LoggerProvider({
    resource: resourceFromAttributes({ 'service.name': SERVICE_NAME }),
    processors: [new SimpleLogRecordProcessor(exporter)],
  });
  logger = provider.getLogger(SERVICE_NAME);
}

/**
 * Emit one structured log to PostHog. Safe no-op when logging is not
 * configured. `attributes` must carry safe scalars only (MF-5).
 */
export function emitLog(
  body: string,
  attributes?: LogAttributes,
  severity: SeverityNumber = SeverityNumber.INFO,
): void {
  try {
    logger?.emit({
      severityNumber: severity,
      severityText: SeverityNumber[severity],
      body,
      attributes,
    });
  } catch {
    // Logging must never break the product.
  }
}

/** Flush + tear down the logs pipeline. Call once on SIGINT / SIGTERM. */
export async function shutdownOtelLogs(): Promise<void> {
  try {
    await provider?.shutdown();
  } finally {
    provider = null;
    logger = null;
  }
}
