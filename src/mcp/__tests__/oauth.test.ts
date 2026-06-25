// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createHttpServer } from '../http.js';
import type { HostConfig } from '../config.js';
import {
  protectedResourceMetadata,
  protectedResourceMetadataPaths,
  authorizationServerIssuer,
  wwwAuthenticateChallenge,
} from '../oauth.js';

const baseConfig = (over: Partial<HostConfig> = {}): HostConfig => ({
  port: 0,
  ivosMcpUrl: null,
  ivosMcpToken: null,
  supabaseUrl: 'https://proj.supabase.co',
  supabaseAnonKey: 'anon',
  slackBotToken: null,
  slackFeedbackChannelId: 'C0',
  mcpPublicUrl: 'https://app.example.com/mcp',
  oauthRequireAuth: false,
  ...over,
});

describe('oauth resource-server metadata (RFC 9728 / 8707)', () => {
  it('advertises this resource + Supabase as the authorization server', () => {
    const cfg = baseConfig();
    const md = protectedResourceMetadata(cfg);
    expect(md.resource).toBe('https://app.example.com/mcp');
    expect(md.authorization_servers).toEqual(['https://proj.supabase.co/auth/v1']);
    expect(md.bearer_methods_supported).toEqual(['header']);
    expect(md.scopes_supported).toEqual(['email']);
  });

  it('honours a configured oauthScope override', () => {
    expect(protectedResourceMetadata(baseConfig({ oauthScope: 'profile' })).scopes_supported).toEqual(['profile']);
  });

  it('derives the AS issuer from the project URL, trimming a trailing slash', () => {
    expect(authorizationServerIssuer(baseConfig({ supabaseUrl: 'https://proj.supabase.co/' }))).toBe(
      'https://proj.supabase.co/auth/v1',
    );
  });

  it('serves both the path-suffixed and bare well-known paths', () => {
    expect(protectedResourceMetadataPaths(baseConfig())).toEqual([
      '/.well-known/oauth-protected-resource/mcp',
      '/.well-known/oauth-protected-resource',
    ]);
    // no path component → only the bare form
    expect(protectedResourceMetadataPaths(baseConfig({ mcpPublicUrl: 'https://app.example.com' }))).toEqual([
      '/.well-known/oauth-protected-resource',
    ]);
  });

  it('builds a spec-compliant WWW-Authenticate challenge pointing at the metadata URL', () => {
    const v = wwwAuthenticateChallenge(baseConfig(), 'invalid_token');
    expect(v).toBe(
      'Bearer resource_metadata="https://app.example.com/.well-known/oauth-protected-resource/mcp", scope="email", error="invalid_token"',
    );
  });
});

describe('oauth http surface', () => {
  let server: Server | undefined;
  afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

  const listen = (cfg: HostConfig): Promise<string> =>
    new Promise((resolve) => {
      server = createHttpServer(cfg);
      server.listen(0, '127.0.0.1', () => {
        const { port } = server!.address() as AddressInfo;
        resolve(`http://127.0.0.1:${port}`);
      });
    });

  it('serves protected-resource metadata as public JSON at the suffixed path', async () => {
    const base = await listen(baseConfig());
    const res = await fetch(`${base}/.well-known/oauth-protected-resource/mcp`);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const body = await res.json();
    expect(body.resource).toBe('https://app.example.com/mcp');
    expect(body.authorization_servers[0]).toBe('https://proj.supabase.co/auth/v1');
  });

  it('challenges an unauthenticated /mcp with 401 + WWW-Authenticate when enforcement is on', async () => {
    const base = await listen(baseConfig({ oauthRequireAuth: true }));
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata=');
  });

  it('does NOT challenge when enforcement is off (flag kill switch)', async () => {
    const base = await listen(baseConfig({ oauthRequireAuth: false }));
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    expect(res.status).not.toBe(401);
  });
});
