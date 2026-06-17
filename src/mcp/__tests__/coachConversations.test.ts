// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registerListCoachConversationsTool } from '../tools/listCoachConversations.js';
import { registerGetCoachConversationTool } from '../tools/getCoachConversation.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

// ---------------------------------------------------------------------------------------
// PostGREST stub — per-(table,verb) FIFO queue, mirroring contextTools.test.ts.
// ---------------------------------------------------------------------------------------
interface Op {
  table: string;
  verb: 'insert' | 'update' | 'select';
  filters: Array<{ op: string; col: string; val: unknown }>;
}
interface Result {
  data: unknown;
  error: { message: string } | null;
}

class Stub {
  readonly ops: Op[] = [];
  private queue: Record<string, Result[]> = {};
  on(table: string, verb: Op['verb'], result: Result): this {
    (this.queue[`${table}:${verb}`] ??= []).push(result);
    return this;
  }
  private take(table: string, verb: Op['verb']): Result {
    return this.queue[`${table}:${verb}`]?.shift() ?? { data: null, error: null };
  }
  from(table: string): Builder {
    return new Builder(table, this.ops, (op) => this.take(op.table, op.verb));
  }
}

class Builder implements PromiseLike<Result> {
  private readonly op: Op;
  constructor(
    table: string,
    private readonly ops: Op[],
    private readonly resolveOp: (op: Op) => Result,
  ) {
    this.op = { table, verb: 'select', filters: [] };
    this.ops.push(this.op);
  }
  select(): this {
    return this;
  }
  private rec(op: string, col: string, val: unknown): this {
    this.op.filters.push({ op, col, val });
    return this;
  }
  eq(col: string, val: unknown): this {
    return this.rec('eq', col, val);
  }
  in(col: string, val: unknown): this {
    return this.rec('in', col, val);
  }
  order(): this {
    return this;
  }
  maybeSingle(): Promise<Result> {
    return Promise.resolve(this.resolveOp(this.op));
  }
  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.resolveOp(this.op)).then(onfulfilled, onrejected);
  }
}

function install(): Stub {
  const stub = new Stub();
  __setUserSupabaseFactory(() => stub as unknown as SupabaseClient);
  return stub;
}

async function connect(register: (s: McpServer) => void): Promise<Client> {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  register(server);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}

afterEach(() => __setUserSupabaseFactory(null));

// ---------------------------------------------------------------------------------------
// list_coach_conversations
// ---------------------------------------------------------------------------------------
describe('list_coach_conversations tool', () => {
  it('denies anonymous callers before any DB read', async () => {
    const client = await connect(registerListCoachConversationsTool); // no stub: a leaked read would throw
    const res = await client.callTool({ name: 'list_coach_conversations', arguments: {} });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/authentication required/i);
  });

  it('lists threads annotated with avatar name and turn count', async () => {
    const stub = install();
    stub.on('chat_sessions', 'select', {
      data: [
        {
          id: 's1',
          title: 'Avatar deep-dive',
          avatar_id: 'av-1',
          conversation_type: 'general',
          field_id: null,
          field_label: null,
          page_context: '/v2/coach',
          chapter_id: null,
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-02T00:00:00Z',
        },
        {
          id: 's2',
          title: 'Brand-level chat',
          avatar_id: null,
          conversation_type: 'general',
          field_id: null,
          field_label: null,
          page_context: null,
          chapter_id: null,
          created_at: '2026-05-30T00:00:00Z',
          updated_at: '2026-05-31T00:00:00Z',
        },
      ],
      error: null,
    });
    stub.on('chat_messages', 'select', {
      data: [{ session_id: 's1' }, { session_id: 's1' }, { session_id: 's2' }],
      error: null,
    });
    stub.on('avatars', 'select', { data: [{ id: 'av-1', name: 'Busy Mom' }], error: null });

    const client = await connect(registerListCoachConversationsTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'list_coach_conversations', arguments: {} }),
    );
    const sc = res.structuredContent as {
      ok: boolean;
      count: number;
      conversations: Array<{ session_id: string; avatar_id: string | null; avatar_name: string | null; message_count: number }>;
    };
    expect(sc.ok).toBe(true);
    expect(sc.count).toBe(2);
    const s1 = sc.conversations.find((c) => c.session_id === 's1');
    expect(s1?.avatar_id).toBe('av-1');
    expect(s1?.avatar_name).toBe('Busy Mom'); // resolved from avatars
    expect(s1?.message_count).toBe(2);
    const s2 = sc.conversations.find((c) => c.session_id === 's2');
    expect(s2?.avatar_id).toBeNull(); // brand-level
    expect(s2?.avatar_name).toBeNull();
    expect(s2?.message_count).toBe(1);
  });

  it('scopes the session query by avatar_id when provided', async () => {
    const stub = install();
    stub.on('chat_sessions', 'select', { data: [], error: null });
    const client = await connect(registerListCoachConversationsTool);
    await runWithIdentity(authed, () =>
      client.callTool({ name: 'list_coach_conversations', arguments: { avatar_id: 'av-9' } }),
    );
    const sessionOp = stub.ops.find((o) => o.table === 'chat_sessions');
    expect(sessionOp?.filters).toContainEqual({ op: 'eq', col: 'avatar_id', val: 'av-9' });
    // chatbot_type is always constrained to the coach.
    expect(sessionOp?.filters).toContainEqual({ op: 'eq', col: 'chatbot_type', val: 'idea-framework-consultant' });
  });

  it('returns an empty list (and skips the tally read) when there are no threads', async () => {
    const stub = install();
    stub.on('chat_sessions', 'select', { data: [], error: null });
    const client = await connect(registerListCoachConversationsTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'list_coach_conversations', arguments: {} }),
    );
    const sc = res.structuredContent as { ok: boolean; count: number; conversations: unknown[] };
    expect(sc.ok).toBe(true);
    expect(sc.count).toBe(0);
    expect(sc.conversations).toEqual([]);
    expect(stub.ops.some((o) => o.table === 'chat_messages')).toBe(false); // no tally when no sessions
  });
});

// ---------------------------------------------------------------------------------------
// get_coach_conversation
// ---------------------------------------------------------------------------------------
describe('get_coach_conversation tool', () => {
  it('denies anonymous callers', async () => {
    const client = await connect(registerGetCoachConversationTool);
    const res = await client.callTool({ name: 'get_coach_conversation', arguments: { session_id: 's1' } });
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBe(true);
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/authentication required/i);
  });

  it('returns the thread metadata + transcript (chronological) with avatar name', async () => {
    const stub = install();
    stub.on('chat_sessions', 'select', {
      data: {
        id: 's1',
        title: 'Avatar deep-dive',
        avatar_id: 'av-1',
        conversation_type: 'general',
        field_id: null,
        field_label: null,
        page_context: '/v2/coach',
        chapter_id: null,
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-02T00:00:00Z',
      },
      error: null,
    });
    stub.on('chat_messages', 'select', {
      data: [
        { role: 'user', content: 'Who is my customer?', created_at: '2026-06-01T00:00:01Z' },
        { role: 'assistant', content: 'Let’s start with one person…', created_at: '2026-06-01T00:00:02Z' },
      ],
      error: null,
    });
    stub.on('avatars', 'select', { data: { name: 'Busy Mom' }, error: null });

    const client = await connect(registerGetCoachConversationTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'get_coach_conversation', arguments: { session_id: 's1' } }),
    );
    const sc = res.structuredContent as {
      ok: boolean;
      conversation: { session_id: string; avatar_id: string | null; avatar_name: string | null };
      messages: Array<{ role: string; content: string }>;
      message_count: number;
    };
    expect(sc.ok).toBe(true);
    expect(sc.conversation.session_id).toBe('s1');
    expect(sc.conversation.avatar_name).toBe('Busy Mom');
    expect(sc.message_count).toBe(2);
    expect(sc.messages.map((m) => m.role)).toEqual(['user', 'assistant']); // chronological
    expect(sc.messages[0].content).toMatch(/who is my customer/i);
  });

  it('returns ok:false / not found (not an error) for an unknown or non-owned thread', async () => {
    const stub = install();
    stub.on('chat_sessions', 'select', { data: null, error: null }); // RLS / unknown id → no row
    const client = await connect(registerGetCoachConversationTool);
    const res = await runWithIdentity(authed, () =>
      client.callTool({ name: 'get_coach_conversation', arguments: { session_id: 'nope' } }),
    );
    const sc = res.structuredContent as { ok: boolean; note: string };
    expect(res.isError).toBeFalsy();
    expect(sc.ok).toBe(false);
    expect(sc.note).toMatch(/not found/i);
  });
});
