/**
 * Layer 1 (service) — Expert Intelligence Loop capture logic.
 *
 * The `capture_correction` tool (Feeder 1) records an EXPERT (admin) user's redirect — the
 * moment they overrule a claim the coach just made — into `expert_corrections`. These expert
 * redirects are the loop's highest-value training signal (see
 * `.feature-factory/expert-intelligence-loop/arch.md`).
 *
 * Auth model: the caller must be a designated EXPERT (the allowlist, see experts.ts — narrower than
 * is_admin). A non-expert caller is a silent no-op — never a write, never a revealed gate
 * (errors.md #1). Writes go through the caller's JWT client under the table's admin-insert RLS
 * policy, so THIS tool's write path needs no service-role key (the gateway's model is RLS-per-JWT;
 * it does hold a service-role client only for its own coach_instructions boot read, unrelated to
 * this tool). Verbatim text is never logged (MF-5) and both DB ops fail SOFT so a lost correction
 * never breaks the coach turn (errors.md #5).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getUserSupabase } from '../supabaseUser.js';
import { safeLog } from '../logging/redact.js';
import { isExpertEmail } from './experts.js';

export interface CorrectionInput {
  coachClaim: string;
  correction: string;
  verbatim?: string;
  toolContext?: string;
  avatarId?: string;
  /** 'mcp' (this tool) | 'chat' (the in-app harvest feeder). Defaults to 'mcp'. */
  source?: 'mcp' | 'chat';
  /** chat_sessions.id (as text) for source='chat'; the MCP session token otherwise. */
  sessionId?: string;
}

export interface CaptureResult {
  ok: boolean;
  captured: boolean;
  note?: string;
  id?: string;
}

/**
 * Is this user a designated EXPERT (the training source — Trevor, not merely an admin)? Resolves
 * the caller's email via their own JWT client (profiles self-read RLS) and checks the expert
 * allowlist (see experts.ts). Deliberately narrower than profiles.is_admin. Fails CLOSED (not
 * expert) on any error — the capture gate must never open on a DB hiccup.
 */
export async function isExpert(
  userId: string,
  client: SupabaseClient = getUserSupabase(),
): Promise<boolean> {
  try {
    const { data, error } = await client
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      safeLog({ level: 'warn', event: 'expert_corrections.expert_lookup_error' });
      return false;
    }
    return isExpertEmail((data as { email?: string } | null)?.email);
  } catch {
    safeLog({ level: 'warn', event: 'expert_corrections.expert_lookup_exception' });
    return false;
  }
}

/**
 * Insert one correction via the caller's JWT client (admin-insert RLS policy: user_id = auth.uid()
 * AND is_admin). Returns `{ ok: false, captured: false }` softly on ANY failure — a lost correction
 * must never surface as an error to the coach mid-conversation.
 */
export async function recordCorrection(
  userId: string,
  input: CorrectionInput,
  client: SupabaseClient = getUserSupabase(),
): Promise<CaptureResult> {
  try {
    const { data, error } = await client
      .from('expert_corrections')
      .insert({
        user_id: userId,
        source: input.source ?? 'mcp',
        session_id: input.sessionId ?? null,
        avatar_id: input.avatarId ?? null,
        coach_claim: input.coachClaim,
        correction: input.correction,
        verbatim: input.verbatim ?? null,
        tool_context: input.toolContext ?? null,
        status: 'new',
      })
      .select('id')
      .single();
    if (error || !data) {
      safeLog({ level: 'warn', event: 'expert_corrections.insert_error' });
      return { ok: false, captured: false, note: 'not recorded' };
    }
    return { ok: true, captured: true, id: data.id as string };
  } catch {
    safeLog({ level: 'warn', event: 'expert_corrections.insert_exception' });
    return { ok: false, captured: false, note: 'not recorded' };
  }
}
