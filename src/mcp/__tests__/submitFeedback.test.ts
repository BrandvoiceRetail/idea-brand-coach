// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { FeedbackNotifier, type FeedbackInput, type FeedbackSink } from '../slack/feedbackNotifier.js';
import { registerSubmitFeedbackTool } from '../tools/submitFeedback.js';
import { setLogSink } from '../logging/redact.js';

const TOKEN = 'xoxb-test-000';
const CHANNEL = 'C0B9YT9TQ6T';
const SLACK_URL = 'https://slack.com/api/chat.postMessage';
const cfg = { slackBotToken: TOKEN, slackFeedbackChannelId: CHANNEL };

/** Records the bodies POSTed to Slack so tests can assert payload shape. */
function recordingFetch(
  status = 200,
  body: Record<string, unknown> = { ok: true },
): { fetch: typeof fetch; bodies: string[]; urls: string[] } {
  const bodies: string[] = [];
  const urls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(input));
    bodies.push(typeof init?.body === 'string' ? init.body : '');
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fetch: fetchImpl, bodies, urls };
}

const SAMPLE: FeedbackInput = {
  message: 'The signature reveal felt slow on my second run.',
  category: 'bug',
  context: 'after generate_signature',
  caller: 'u_abc123',
};

describe('FeedbackNotifier', () => {
  it('degrades gracefully (ok:false) when no bot token is configured — never throws', async () => {
    const notifier = new FeedbackNotifier({ slackBotToken: null, slackFeedbackChannelId: CHANNEL });
    expect(notifier.configured).toBe(false);
    const res = await notifier.send(SAMPLE);
    expect(res.ok).toBe(false);
    expect(res.note).toMatch(/not configured/i);
  });

  it('posts message + caller + category + channel to chat.postMessage on success', async () => {
    const rec = recordingFetch(200, { ok: true });
    const notifier = new FeedbackNotifier(cfg, rec.fetch);
    const res = await notifier.send(SAMPLE);
    expect(res.ok).toBe(true);
    expect(rec.urls).toEqual([SLACK_URL]);
    const body = rec.bodies[0];
    expect(body).toContain(SAMPLE.message);
    expect(body).toContain('u_abc123');
    expect(body).toContain('bug');
    expect(JSON.parse(body).channel).toBe(CHANNEL);
  });

  it('GOTCHA: returns ok:false when Slack replies HTTP 200 but body.ok is false', async () => {
    const rec = recordingFetch(200, { ok: false, error: 'not_in_channel' });
    const notifier = new FeedbackNotifier(cfg, rec.fetch);
    const res = await notifier.send(SAMPLE);
    expect(res.ok).toBe(false);
    expect(res.note).toMatch(/not_in_channel/);
  });

  it('returns ok:false on a non-2xx Slack response', async () => {
    const rec = recordingFetch(500, {});
    const notifier = new FeedbackNotifier(cfg, rec.fetch);
    const res = await notifier.send(SAMPLE);
    expect(res.ok).toBe(false);
    expect(res.note).toMatch(/HTTP 500/);
  });

  it('returns ok:false (never throws) when Slack is unreachable', async () => {
    const throwingFetch = (async () => {
      throw new Error('network down');
    }) as typeof fetch;
    const notifier = new FeedbackNotifier(cfg, throwingFetch);
    const res = await notifier.send(SAMPLE);
    expect(res.ok).toBe(false);
    expect(res.note).toMatch(/unreachable/i);
  });

  it('MF-5: never writes the feedback text to logs (only metadata)', async () => {
    const lines: string[] = [];
    const prev = setLogSink((line) => lines.push(line));
    try {
      const rec = recordingFetch(200, { ok: true });
      const notifier = new FeedbackNotifier(cfg, rec.fetch);
      await notifier.send(SAMPLE);
    } finally {
      setLogSink(prev);
    }
    const allLogs = lines.join('\n');
    expect(allLogs).not.toContain(SAMPLE.message);
    expect(allLogs).toContain('feedback.sent'); // metadata line was emitted
  });
});

describe('submit_feedback tool', () => {
  async function toolClient(sink: FeedbackSink): Promise<Client> {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerSubmitFeedbackTool(server, sink);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return client;
  }

  it('delivers the message to the sink and reports success', async () => {
    const calls: FeedbackInput[] = [];
    const sink: FeedbackSink = {
      async send(input) {
        calls.push(input);
        return { ok: true };
      },
    };
    const client = await toolClient(sink);
    const res = await client.callTool({
      name: 'submit_feedback',
      arguments: { message: 'Love the new canvas export.', category: 'praise' },
    });
    expect(res.isError).toBeFalsy();
    expect((res.structuredContent as { ok: boolean }).ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].message).toBe('Love the new canvas export.');
    expect(calls[0].category).toBe('praise');
    expect(calls[0].caller).toBe('anon'); // anonymous in-test caller
  });

  it('surfaces an error result when delivery fails', async () => {
    const sink: FeedbackSink = {
      async send() {
        return { ok: false, note: 'feedback channel unreachable' };
      },
    };
    const client = await toolClient(sink);
    const res = await client.callTool({
      name: 'submit_feedback',
      arguments: { message: 'Anything' },
    });
    expect(res.isError).toBe(true);
    expect((res.structuredContent as { ok: boolean }).ok).toBe(false);
  });
});
