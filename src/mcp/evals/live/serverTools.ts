/**
 * Boot the real in-process MCP server and read its advertised tools.
 * Shared by the A1 contract checks (liveTier) and the A2 replay (anthropic).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../server.js';
import type { HostConfig } from '../../config.js';
import type { AgentTool } from './replay.js';

/** Inert config — listing tools invokes no tool, so no real Supabase/IV-OS/Slack is needed. */
export const STUB_CONFIG: HostConfig = {
  port: 0,
  ivosMcpUrl: null,
  ivosMcpToken: null,
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon',
  slackBotToken: null,
  slackFeedbackChannelId: 'C0EVALS',
};

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const { server } = createServer(STUB_CONFIG);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'evals-live', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

/** Name + description of every advertised tool (A1 contract checks). */
export async function listLiveTools(): Promise<{ name: string; description: string }[]> {
  return withClient(async (client) => {
    const { tools } = await client.listTools();
    return tools.map((t) => ({ name: t.name, description: t.description ?? '' }));
  });
}

/** Full agent tool defs incl. input schema (A2 replay — the model needs the schema to call). */
export async function listLiveAgentTools(): Promise<AgentTool[]> {
  return withClient(async (client) => {
    const { tools } = await client.listTools();
    return tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? { type: 'object' },
    }));
  });
}
