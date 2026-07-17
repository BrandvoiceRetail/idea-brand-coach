/**
 * Layer 1 (service) — Expert Intelligence Loop, Feeder 2: in-app chat harvest.
 *
 * The connector capture tool (Feeder 1, capture_correction) covers the MCP surface. This sweep
 * covers the IN-APP surface: it reads a designated expert's in-app chat (chat_messages, role
 * user|assistant) via the SERVICE-ROLE client, detects REDIRECT turns — an expert user turn that
 * overrules/corrects the coach turn immediately before it — and normalizes them into
 * `expert_corrections` as source='chat'.
 *
 * Idempotent (errors.md #9): the caller passes the last high-water mark (`sinceIso`) and the sweep
 * returns the max `created_at` it processed, so the next run starts after it — no re-ingest.
 *
 * Redirect detection is CONSERVATIVE (precision over recall, errors.md #10): an ambiguous turn is
 * skipped, not mis-captured; the human review pass is the safety net. Detection is pure +
 * injectable so it unit-tests without a DB or a clock.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceRoleSupabase } from '../supabaseServer.js';
import { safeLog } from '../logging/redact.js';
import { expertEmails } from './experts.js';

/** Max in-app messages scanned per expert per sweep — bounds an otherwise unbounded read (MCP AGENTS.md). */
export const HARVEST_MESSAGE_LIMIT = 500;
/** Max chars persisted per correction field (coach_claim / correction / verbatim). */
export const HARVEST_FIELD_MAX_CHARS = 2000;

/** DB `role` is user|assistant; the harvest shape is user|coach (assistant→coach). */
export interface ChatTurn {
  role: 'user' | 'coach';
  text: string;
  createdAt: string;
}

export interface SessionTurns {
  sessionId: string;
  avatarId?: string;
  turns: ChatTurn[];
}

export interface HarvestedCorrection {
  userId: string;
  sessionId: string;
  avatarId?: string;
  coachClaim: string;
  correction: string;
  verbatim: string;
  createdAt: string;
}

/**
 * Conservative redirect signals. A user turn matching ANY of these, when it directly follows a
 * coach turn, is read as the expert overruling that claim. Tuned for precision — broad words like
 * a bare "wrong" only count anchored to a correction phrase.
 */
const REDIRECT_PATTERNS: readonly RegExp[] = [
  /^\s*(no|nope|wrong|incorrect)\b[\s,.!:;-]/i, // opens with a negation
  /\b(that|this|it)'?s\s+(not\s+right|wrong|incorrect|not\s+correct|horseshit|nonsense|off\s+the\s+mark)\b/i,
  /\byou'?re\s+wrong\b/i,
  /\bnot\s+quite\b/i,
  /\bi\s+disagree\b/i,
  /\bi\s+don'?t\s+(agree|think)\b/i,
  /\bthat'?s\s+(not|incorrect|wrong)\b/i,
  /\bare\s+you\s+sure\b/i,
  /\bwhat\s+are\s+you\s+talking\s+about\b/i,
  /\b(reconsider|rethink)\b/i,
];

export function isRedirect(text: string): boolean {
  return REDIRECT_PATTERNS.some((re) => re.test(text));
}

function clip(s: string): string {
  return s.length <= HARVEST_FIELD_MAX_CHARS ? s : s.slice(0, HARVEST_FIELD_MAX_CHARS);
}

/**
 * Pure: from one session's ordered turns, emit a correction for each user turn that redirects the
 * coach turn immediately before it. coach_claim = that prior coach turn; correction/verbatim = the
 * expert's words. The first turn can never be a redirect (nothing precedes it).
 */
export function detectRedirects(
  userId: string,
  session: SessionTurns,
): HarvestedCorrection[] {
  const out: HarvestedCorrection[] = [];
  for (let i = 1; i < session.turns.length; i++) {
    const cur = session.turns[i];
    const prev = session.turns[i - 1];
    if (cur.role !== 'user' || prev.role !== 'coach') continue;
    if (!isRedirect(cur.text)) continue;
    out.push({
      userId,
      sessionId: session.sessionId,
      avatarId: session.avatarId,
      coachClaim: clip(prev.text),
      correction: clip(cur.text),
      verbatim: clip(cur.text),
      createdAt: cur.createdAt,
    });
  }
  return out;
}

/** Injectable IO seam so the orchestration unit-tests without a DB. */
export interface HarvestDeps {
  listExpertUserIds(): Promise<string[]>;
  /** Sessions (with turns) for one expert with any message newer than sinceIso. */
  readSessions(userId: string, sinceIso: string | null): Promise<SessionTurns[]>;
  insertCorrections(rows: HarvestedCorrection[]): Promise<void>;
}

export interface HarvestSummary {
  experts: number;
  scannedSessions: number;
  captured: number;
  /** Max created_at seen across captured corrections — the new high-water mark, or sinceIso if none. */
  highWater: string | null;
}

/**
 * Sweep every expert's in-app chat since `sinceIso`, capturing redirect turns as source='chat'.
 * Never throws for one bad expert — logs and continues (a partial sweep still makes progress).
 */
export async function harvestExpertChats(
  deps: HarvestDeps,
  opts: { sinceIso: string | null },
): Promise<HarvestSummary> {
  const userIds = await deps.listExpertUserIds();
  let scannedSessions = 0;
  let captured = 0;
  let highWater = opts.sinceIso;

  for (const userId of userIds) {
    try {
      const sessions = await deps.readSessions(userId, opts.sinceIso);
      scannedSessions += sessions.length;
      const corrections = sessions.flatMap((s) => detectRedirects(userId, s));
      if (corrections.length === 0) continue;
      await deps.insertCorrections(corrections);
      captured += corrections.length;
      for (const c of corrections) {
        if (!highWater || c.createdAt > highWater) highWater = c.createdAt;
      }
    } catch {
      safeLog({ level: 'warn', event: 'expert_harvest.user_failed' });
    }
  }

  safeLog({ event: 'expert_harvest.sweep', experts: userIds.length, scannedSessions, captured });
  return { experts: userIds.length, scannedSessions, captured, highWater };
}

/** Real IO deps over the service-role client (used by scripts/harvest-expert-chats). */
export function buildHarvestDeps(client: SupabaseClient = getServiceRoleSupabase()): HarvestDeps {
  return {
    async listExpertUserIds() {
      // Gate on the expert allowlist (Trevor), NOT is_admin — same designation as Feeder 1.
      const { data, error } = await client.from('profiles').select('id').in('email', expertEmails());
      if (error) throw new Error(`profiles: ${error.message}`);
      return (data ?? []).map((r: { id: string }) => r.id);
    },

    async readSessions(userId, sinceIso) {
      let q = client
        .from('chat_messages')
        .select('session_id, role, content, created_at')
        .eq('user_id', userId)
        .eq('chatbot_type', 'idea-framework-consultant')
        .order('created_at', { ascending: true })
        .limit(HARVEST_MESSAGE_LIMIT);
      if (sinceIso) q = q.gt('created_at', sinceIso);
      const { data: msgs, error } = await q;
      if (error) throw new Error(`chat_messages: ${error.message}`);

      const bySession = new Map<string, ChatTurn[]>();
      for (const m of (msgs ?? []) as Array<{ session_id: string | null; role: string; content: string; created_at: string }>) {
        if (!m.session_id) continue;
        const role: 'user' | 'coach' = m.role === 'assistant' ? 'coach' : 'user';
        const turns = bySession.get(m.session_id) ?? [];
        turns.push({ role, text: m.content, createdAt: m.created_at });
        bySession.set(m.session_id, turns);
      }
      if (bySession.size === 0) return [];

      // Resolve avatar_id per session.
      const sessionIds = [...bySession.keys()];
      const { data: sessions } = await client.from('chat_sessions').select('id, avatar_id').in('id', sessionIds);
      const avatarBySession = new Map<string, string | undefined>(
        ((sessions ?? []) as Array<{ id: string; avatar_id: string | null }>).map((s) => [s.id, s.avatar_id ?? undefined]),
      );

      return sessionIds.map((sessionId) => ({
        sessionId,
        avatarId: avatarBySession.get(sessionId),
        turns: bySession.get(sessionId) ?? [],
      }));
    },

    async insertCorrections(rows) {
      const payload = rows.map((r) => ({
        user_id: r.userId,
        source: 'chat',
        session_id: r.sessionId,
        avatar_id: r.avatarId ?? null,
        coach_claim: r.coachClaim,
        correction: r.correction,
        verbatim: r.verbatim,
        status: 'new',
      }));
      const { error } = await client.from('expert_corrections').insert(payload);
      if (error) throw new Error(`expert_corrections insert: ${error.message}`);
    },
  };
}
