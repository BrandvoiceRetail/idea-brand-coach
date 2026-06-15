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
import { safeLog } from './logging/redact.js';

const MCP_PATH = '/mcp';

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

  await runWithIdentity(identity, async () => {
    const { server } = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  });
}

export function createHttpServer(config: HostConfig = loadConfig()): http.Server {
  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (req.method === 'POST' && (req.url === MCP_PATH || req.url?.startsWith(`${MCP_PATH}?`))) {
      handleMcp(req, res).catch((err) => {
        safeLog({ level: 'error', event: 'http.mcp_error', reason: err instanceof Error ? err.name : 'unknown' });
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
