/**
 * Brand-Coach MCP host — entry point.
 *
 * Run: `npm run mcp:dev` (watch) or `npm run mcp:start`.
 * Env: MCP_PORT, IVOS_MCP_URL, IVOS_MCP_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY.
 */
import { startHttpServer } from './http.js';
import { loadConfig } from './config.js';

startHttpServer(loadConfig());
