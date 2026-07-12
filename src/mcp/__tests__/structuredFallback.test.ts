import { describe, it, expect, vi } from 'vitest';
import { mirrorStructuredContent, registerStructuredFallback } from '../structuredFallback.js';

describe('mirrorStructuredContent', () => {
  it('appends a JSON text block carrying data-bearing structuredContent', () => {
    const result = {
      content: [{ type: 'text', text: '33 coach conversation(s).' }],
      structuredContent: { ok: true, count: 1, conversations: [{ session_id: 's1', avatar_id: 'av-1' }] },
    };
    const out = mirrorStructuredContent(result) as {
      content: Array<{ type: string; text: string }>;
      structuredContent: unknown;
    };

    expect(out.content).toHaveLength(2);
    // Original summary is preserved; the appended block carries the ids the model needs.
    expect(out.content[0].text).toBe('33 coach conversation(s).');
    expect(out.content[1].text).toContain('"session_id":"s1"');
    expect(out.content[1].text).toContain('"avatar_id":"av-1"');
    // structuredContent is left intact for clients that do read it.
    expect(out.structuredContent).toEqual(result.structuredContent);
  });

  it('skips pure bookkeeping payloads (ok/note only)', () => {
    const result = {
      content: [{ type: 'text', text: 'Authentication required.' }],
      structuredContent: { ok: false, note: 'authentication required' },
      isError: true,
    };
    expect(mirrorStructuredContent(result)).toBe(result); // unchanged reference
  });

  it('does not double-append when a text block already contains the JSON', () => {
    const json = JSON.stringify({ ok: true, count: 0, conversations: [] });
    const result = {
      content: [{ type: 'text', text: `here you go: ${json}` }],
      structuredContent: { ok: true, count: 0, conversations: [] },
    };
    expect(mirrorStructuredContent(result)).toBe(result);
  });

  it('passes through results with no structuredContent and non-result shapes', () => {
    const plain = { content: [{ type: 'text', text: 'hi' }] };
    expect(mirrorStructuredContent(plain)).toBe(plain);
    expect(mirrorStructuredContent('nope')).toBe('nope');
    expect(mirrorStructuredContent(null)).toBe(null);
  });
});

type Handler = (...a: unknown[]) => Promise<unknown>;

describe('registerStructuredFallback', () => {
  it('wraps registered handlers so their results are mirrored', async () => {
    const calls: unknown[][] = [];
    const server = { registerTool: vi.fn((...args: unknown[]) => calls.push(args)) };
    registerStructuredFallback(server as never);

    const handler = vi.fn(async () => ({
      content: [{ type: 'text', text: 'Conversation “X” — 2 turn(s).' }],
      structuredContent: { ok: true, conversation: { session_id: 's1' }, messages: [], message_count: 2 },
    }));
    (server as unknown as { registerTool: (...a: unknown[]) => unknown }).registerTool('get_coach_conversation', {}, handler);

    const wrapped = calls[0][2] as Handler;
    const out = (await wrapped({}, {})) as { content: Array<{ type: string; text: string }> };

    expect(handler).toHaveBeenCalledTimes(1);
    expect(out.content).toHaveLength(2);
    expect(out.content[1].text).toContain('"session_id":"s1"');
  });
});
