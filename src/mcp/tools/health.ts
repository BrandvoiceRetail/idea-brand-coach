/**
 * Layer 2 (tool) — `health`.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IvosLedgerClient } from '../ivos/client.js';
import { getHealth } from '../service/health.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

export function registerHealthTool(server: McpServer, ivos: IvosLedgerClient): void {
  server.registerTool(
    'health',
    {
      title: 'Health',
      description: 'Liveness + configuration probe for the brand-coach MCP gateway.',
      inputSchema: {},
    },
    async () => {
      const report = getHealth(ivos.configured);
      safeLog({ event: 'tool.health', caller: userTag(getIdentity()), ivosConfigured: report.ivosConfigured });
      return {
        content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
        structuredContent: report as unknown as Record<string, unknown>,
      };
    },
  );
}
