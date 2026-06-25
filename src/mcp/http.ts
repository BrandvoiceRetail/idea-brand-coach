/**
 * Streamable-HTTP transport wiring (Node `http`).
 *
 * Stateless: a fresh MCP server + transport per POST /mcp request, all run inside
 * `runWithIdentity(...)` so every tool handler sees only its own caller (no identity
 * bleed across concurrent requests). GET /healthz is a plain liveness endpoint that
 * does not touch the MCP layer.
 */
import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';
import { loadConfig, type HostConfig } from './config.js';
import { resolveIdentity, runWithIdentity } from './context/identity.js';
import { resolveRequestMeta, runWithRequestMeta } from './context/requestMeta.js';
import { safeLog } from './logging/redact.js';
import { captureMcpEvent, captureMcpException } from './posthog.js';
import { emitLog } from './instrumentation.js';
import { SeverityNumber } from '@opentelemetry/api-logs';
import {
  protectedResourceMetadata,
  protectedResourceMetadataPaths,
  wwwAuthenticateChallenge,
} from './oauth.js';

const MCP_PATH = '/mcp';

/**
 * Browser-origin allowlist for the public endpoint. Non-browser callers (Claude
 * Code, Claude Desktop, the `mcp-remote` bridge) connect server-side and are not
 * subject to CORS; the web client (claude.ai) is. We reflect an allowed Origin
 * rather than wildcarding, and always advertise the headers/methods so a preflight
 * never blocks the bearer-auth handshake. Lives in the gateway (not just Caddy) so
 * it travels with the service when it's extracted to its own repo.
 */
const ALLOWED_ORIGINS = new Set(['https://claude.ai', 'https://claude.com']);

function applyCors(req: http.IncomingMessage, res: http.ServerResponse): void {
  const origin = req.headers['origin'] as string | undefined;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  );
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function isMcpUrl(url: string | undefined): boolean {
  return url === MCP_PATH || Boolean(url?.startsWith(`${MCP_PATH}?`));
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/** Bare path of a request URL (drops query string). */
function pathOf(url: string | undefined): string {
  return (url ?? '').split('?', 1)[0];
}

/**
 * Serve the RFC 9728 protected-resource metadata. Public, credential-free discovery
 * doc — wildcard CORS so a browser-based MCP client can fetch it too.
 */
function serveProtectedResourceMetadata(config: HostConfig, res: http.ServerResponse): void {
  res.writeHead(200, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=3600',
  });
  res.end(JSON.stringify(protectedResourceMetadata(config)));
}

/** RFC 9728 §5.1 401 challenge — the signal that starts an OAuth client's flow. */
function sendUnauthorized(config: HostConfig, res: http.ServerResponse): void {
  res.setHeader('WWW-Authenticate', wwwAuthenticateChallenge(config, 'invalid_token'));
  res.writeHead(401, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'unauthorized', error_description: 'authentication required' }));
}

/** Was a Bearer token present (regardless of validity)? Distinguishes an expired/invalid
 *  token (client will refresh) from no token at all (first connect) on a 401. */
function hadBearer(authHeader: string | undefined): boolean {
  return /^Bearer\s+\S/i.test((authHeader ?? '').trim());
}

/** Extract the MCP handshake signal from a request body: whether it's an `initialize`
 *  call and, if so, the client's self-reported name/version. Used for the
 *  authenticated-session telemetry signal. Tolerant of any body shape. */
export function initializeInfo(body: unknown): {
  isInitialize: boolean;
  clientName: string | null;
  clientVersion: string | null;
} {
  const miss = { isInitialize: false, clientName: null, clientVersion: null };
  if (!body || typeof body !== 'object' || Array.isArray(body)) return miss;
  const b = body as { method?: unknown; params?: unknown };
  if (b.method !== 'initialize') return miss;
  const params = b.params && typeof b.params === 'object' ? (b.params as { clientInfo?: unknown }) : {};
  const ci = params.clientInfo && typeof params.clientInfo === 'object'
    ? (params.clientInfo as { name?: unknown; version?: unknown })
    : {};
  return {
    isInitialize: true,
    clientName: typeof ci.name === 'string' ? ci.name : null,
    clientVersion: typeof ci.version === 'string' ? ci.version : null,
  };
}

async function handleMcp(
  config: HostConfig,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid JSON body' }));
    return;
  }

  const identity = await resolveIdentity(req.headers['authorization'] as string | undefined);
  const meta = resolveRequestMeta(req.headers);

  // OAuth enforcement (flag-gated kill switch): an unauthenticated/invalid-token request
  // gets the RFC 9728 challenge so the client kicks off the Supabase OAuth flow.
  if (config.oauthRequireAuth && !identity.authenticated) {
    const hadToken = hadBearer(req.headers['authorization'] as string | undefined);
    safeLog({ event: 'http.mcp_unauthorized', had_token: hadToken });
    // Telemetry: the OAuth-funnel entry point. had_token=true => expired/invalid token
    // (client should refresh); false => first/anonymous connect.
    captureMcpEvent('anon', 'mcp_auth_challenge', { had_token: hadToken, country: meta.country });
    sendUnauthorized(config, res);
    return;
  }

  // Telemetry: an authenticated client completed the MCP handshake — a per-connection
  // "session authenticated" signal (the successful end of the OAuth funnel), broken down
  // by client. Fires only on `initialize`, not on every tool call.
  if (identity.authenticated) {
    const init = initializeInfo(body);
    if (init.isInitialize) {
      captureMcpEvent(identity.userId ?? 'anon', 'mcp_session_authenticated', {
        client_name: init.clientName,
        client_version: init.clientVersion,
        country: meta.country,
      });
    }
  }

  await runWithIdentity(identity, () => runWithRequestMeta(meta, async () => {
    const { server } = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }));
}

export function createHttpServer(config: HostConfig = loadConfig()): http.Server {
  const wellKnownPaths = new Set(protectedResourceMetadataPaths(config));
  return http.createServer((req, res) => {
    // CORS preflight for the MCP endpoint — answer before any routing/body read.
    if (req.method === 'OPTIONS' && isMcpUrl(req.url)) {
      applyCors(req, res);
      res.writeHead(204);
      res.end();
      return;
    }
    // RFC 9728 protected-resource metadata — public OAuth discovery (any method-safe GET).
    if ((req.method === 'GET' || req.method === 'HEAD') && wellKnownPaths.has(pathOf(req.url))) {
      serveProtectedResourceMetadata(config, res);
      return;
    }
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (req.method === 'POST' && isMcpUrl(req.url)) {
      applyCors(req, res); // set before the transport writes headers so they survive
      handleMcp(config, req, res).catch((err) => {
        safeLog({ level: 'error', event: 'http.mcp_error', reason: err instanceof Error ? err.name : 'unknown' });
        captureMcpException(err, undefined, { layer: 'http' });
        captureMcpEvent('server', 'mcp_http_error', { error_name: err instanceof Error ? err.name : 'unknown' });
        emitLog('mcp http request failed', { error_name: err instanceof Error ? err.name : 'unknown' }, SeverityNumber.ERROR);
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'internal error' }));
        }
      });
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
}

export function startHttpServer(config: HostConfig = loadConfig()): http.Server {
  const srv = createHttpServer(config);
  srv.listen(config.port, () => {
    safeLog({ event: 'http.listening', port: config.port, mcpPath: MCP_PATH, ivosConfigured: Boolean(config.ivosMcpUrl) });
  });
  return srv;
}
