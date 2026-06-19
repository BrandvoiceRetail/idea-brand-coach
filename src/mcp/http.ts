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

async function handleMcp(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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
  return http.createServer((req, res) => {
    // CORS preflight for the MCP endpoint — answer before any routing/body read.
    if (req.method === 'OPTIONS' && isMcpUrl(req.url)) {
      applyCors(req, res);
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (req.method === 'POST' && isMcpUrl(req.url)) {
      applyCors(req, res); // set before the transport writes headers so they survive
      handleMcp(req, res).catch((err) => {
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
