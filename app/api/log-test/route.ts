/**
 * PostHog Logs — example Next.js API route that emits a log, per PostHog's
 * "Integrate with Next.js" guide (step 3).
 *
 * ⚠️ Reference only: this Vite repo has no Next.js App Router, so this route is
 * never served. The live server-side emit path for this codebase is
 * `src/mcp/http.ts` via `src/mcp/instrumentation.ts` (the Node MCP server).
 */
import { SeverityNumber, type Logger } from '@opentelemetry/api-logs';

export async function GET(): Promise<Response> {
  const logger = (globalThis as unknown as { __posthogLogger?: Logger }).__posthogLogger;
  logger?.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: 'INFO',
    body: 'API route called',
    attributes: { route: '/api/log-test' },
  });
  return Response.json({ ok: true });
}
