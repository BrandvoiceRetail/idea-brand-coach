/**
 * Brand-Coach MCP host — entry point.
 *
 * Run: `npm run mcp:dev` (watch) or `npm run mcp:start`.
 * Env: MCP_PORT, IVOS_MCP_URL, IVOS_MCP_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY.
 */
import { startHttpServer } from './http.js';
import { loadConfig, SERVER_VERSION } from './config.js';
import { shutdownPostHog } from './posthog.js';
import { initOtelLogs, emitLog, shutdownOtelLogs } from './instrumentation.js';

initOtelLogs();

const config = loadConfig();
startHttpServer(config);
emitLog('brand-coach MCP server started', { 'service.version': SERVER_VERSION, port: config.port });

const shutdown = async (): Promise<void> => {
  await shutdownPostHog();
  await shutdownOtelLogs();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
