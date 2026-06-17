/**
 * Layer 3 (service) — read coach conversations over the RLS-bound user client.
 *
 * Coach conversations are the user's Brand-Coach chat threads: a `chat_sessions` row
 * (the thread) with its `chat_messages` (the turns). Both are RLS-scoped to
 * `user_id = auth.uid()` by the JWT-bound client (supabaseUser.ts), so these reads can
 * only ever see the caller's own threads — no service-role, no cross-user bleed.
 *
 * "Per avatar": a session optionally carries `avatar_id` (nullable FK → avatars; a NULL
 * row is a brand-level thread not tied to one avatar). `listConversations` filters by it
 * and annotates each thread with the avatar's display name so an agent can group threads
 * per avatar; `getConversation` returns one thread's full transcript in chronological
 * order. Reads only — no writes, no edge-fn calls.
 *
 * Scoped to the IDEA-framework coach (`chatbot_type = 'idea-framework-consultant'`), the
 * only chatbot persisted to these tables today (src/types/chat.ts).
 */
import { getUserSupabase } from '../supabaseUser.js';

const SESSIONS_TABLE = 'chat_sessions';
const MESSAGES_TABLE = 'chat_messages';
const AVATARS_TABLE = 'avatars';

/** The only persisted coach chatbot; mirrors `ChatbotType` in src/types/chat.ts. */
const COACH_CHATBOT_TYPE = 'idea-framework-consultant';

/** One coach thread in a list view: metadata + its turn count, newest-active first. */
export interface ConversationSummary {
  session_id: string;
  title: string;
  /** Avatar scope; null for a brand-level (no-avatar) thread. */
  avatar_id: string | null;
  /** Resolved avatar display name, or null when brand-level / avatar deleted. */
  avatar_name: string | null;
  conversation_type: string;
  field_id: string | null;
  field_label: string | null;
  page_context: string | null;
  chapter_id: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

/** One turn of a conversation transcript. */
export interface ConversationMessage {
  role: string;
  content: string;
  created_at: string;
}

/** A single thread plus its full transcript (chronological). */
export interface ConversationDetail extends Omit<ConversationSummary, 'message_count'> {
  messages: ConversationMessage[];
  message_count: number;
}

/** Raised when a conversation read fails at the DB layer. */
export class CoachConversationError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CoachConversationError';
  }
}

/** A `chat_sessions` row, as read back (only the columns we surface). */
interface SessionRow {
  id: string;
  title: string;
  avatar_id: string | null;
  conversation_type: string | null;
  field_id: string | null;
  field_label: string | null;
  page_context: string | null;
  chapter_id: string | null;
  created_at: string;
  updated_at: string;
}

const SESSION_COLUMNS =
  'id, title, avatar_id, conversation_type, field_id, field_label, page_context, chapter_id, created_at, updated_at';

/** Map the caller's avatars to {id → name} for annotating threads (one read, RLS-scoped). */
async function loadAvatarNames(): Promise<Map<string, string>> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase.from(AVATARS_TABLE).select('id, name');
  if (error) {
    throw new CoachConversationError(`failed to read avatars: ${error.message}`, error);
  }
  const names = new Map<string, string>();
  for (const row of (data as Array<{ id: string; name: string }> | null) ?? []) {
    names.set(row.id, row.name);
  }
  return names;
}

/** Options for {@link listConversations}. */
export interface ListConversationsOptions {
  /** Filter to one avatar's threads; omit for ALL of the caller's coach threads. */
  avatarId?: string;
}

/**
 * List the caller's coach conversations (newest-active first), each annotated with its
 * avatar name and turn count. With `avatarId` set, returns only that avatar's threads;
 * omitted, returns every coach thread (each carrying its `avatar_id` so an agent can
 * group per avatar). RLS scopes every read to the caller.
 */
export async function listConversations(
  opts: ListConversationsOptions = {},
): Promise<ConversationSummary[]> {
  const supabase = getUserSupabase();

  let sessionQuery = supabase
    .from(SESSIONS_TABLE)
    .select(SESSION_COLUMNS)
    .eq('chatbot_type', COACH_CHATBOT_TYPE);
  if (opts.avatarId !== undefined) {
    sessionQuery = sessionQuery.eq('avatar_id', opts.avatarId);
  }

  const { data: sessionData, error: sessionError } = await sessionQuery.order('updated_at', {
    ascending: false,
  });
  if (sessionError) {
    throw new CoachConversationError(`failed to list conversations: ${sessionError.message}`, sessionError);
  }
  const sessions = (sessionData as SessionRow[] | null) ?? [];
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  // Tally turns only for the threads we're returning, and resolve avatar names — both
  // RLS-scoped, run together. The tally selects just session_id (no message content).
  const [counts, avatarNames] = await Promise.all([
    tallyMessages(sessionIds),
    loadAvatarNames(),
  ]);

  return sessions.map((s) => ({
    session_id: s.id,
    title: s.title,
    avatar_id: s.avatar_id,
    avatar_name: s.avatar_id ? (avatarNames.get(s.avatar_id) ?? null) : null,
    conversation_type: s.conversation_type ?? 'general',
    field_id: s.field_id,
    field_label: s.field_label,
    page_context: s.page_context,
    chapter_id: s.chapter_id,
    message_count: counts.get(s.id) ?? 0,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));
}

/** Count turns per session for the given session ids (content never read). */
async function tallyMessages(sessionIds: string[]): Promise<Map<string, number>> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select('session_id')
    .in('session_id', sessionIds);
  if (error) {
    throw new CoachConversationError(`failed to count messages: ${error.message}`, error);
  }
  const counts = new Map<string, number>();
  for (const row of (data as Array<{ session_id: string | null }> | null) ?? []) {
    if (row.session_id) counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Read one coach conversation by session id with its full transcript (oldest turn
 * first), or `null` when no such thread is visible to the caller (RLS / wrong owner /
 * unknown id). The avatar name is resolved when the thread is avatar-scoped.
 */
export async function getConversation(sessionId: string): Promise<ConversationDetail | null> {
  const supabase = getUserSupabase();

  const { data: sessionData, error: sessionError } = await supabase
    .from(SESSIONS_TABLE)
    .select(SESSION_COLUMNS)
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError) {
    throw new CoachConversationError(`failed to read conversation: ${sessionError.message}`, sessionError);
  }
  const session = sessionData as SessionRow | null;
  if (!session) return null;

  const { data: messageData, error: messageError } = await supabase
    .from(MESSAGES_TABLE)
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (messageError) {
    throw new CoachConversationError(`failed to read messages: ${messageError.message}`, messageError);
  }
  const messages = ((messageData as ConversationMessage[] | null) ?? []).map((m) => ({
    role: m.role,
    content: m.content,
    created_at: m.created_at,
  }));

  let avatarName: string | null = null;
  if (session.avatar_id) {
    const { data: avatarData, error: avatarError } = await supabase
      .from(AVATARS_TABLE)
      .select('name')
      .eq('id', session.avatar_id)
      .maybeSingle();
    if (avatarError) {
      throw new CoachConversationError(`failed to read avatar: ${avatarError.message}`, avatarError);
    }
    avatarName = (avatarData as { name: string } | null)?.name ?? null;
  }

  return {
    session_id: session.id,
    title: session.title,
    avatar_id: session.avatar_id,
    avatar_name: avatarName,
    conversation_type: session.conversation_type ?? 'general',
    field_id: session.field_id,
    field_label: session.field_label,
    page_context: session.page_context,
    chapter_id: session.chapter_id,
    created_at: session.created_at,
    updated_at: session.updated_at,
    messages,
    message_count: messages.length,
  };
}
