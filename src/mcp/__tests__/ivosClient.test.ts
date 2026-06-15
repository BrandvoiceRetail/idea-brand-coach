// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { IvosLedgerClient } from '../ivos/client.js';

describe('IvosLedgerClient (consumption adapter resilience)', () => {
  it('reports unconfigured when no IVOS_MCP_URL', async () => {
    const c = new IvosLedgerClient({ ivosMcpUrl: null, ivosMcpToken: null });
    expect(c.configured).toBe(false);
    const list = await c.listAssets({});
    expect(list.available).toBe(false);
    expect(list.data).toEqual([]);
    expect(list.note).toMatch(/not configured/i);
    const get = await c.getAsset('req-1');
    expect(get.available).toBe(false);
    expect(get.data).toBeNull();
  });

  it('degrades gracefully (never throws) when IV-OS is unreachable', async () => {
    // Reserved TEST-NET address → connection fails fast; adapter must swallow it.
    const c = new IvosLedgerClient({ ivosMcpUrl: 'http://192.0.2.1:9/mcp', ivosMcpToken: null });
    expect(c.configured).toBe(true);
    const list = await c.listAssets({ limit: 5 });
    expect(list.available).toBe(false);
    expect(list.data).toEqual([]);
    expect(list.note).toMatch(/unreachable/i);
  }, 20000);
});
