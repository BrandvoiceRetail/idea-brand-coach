/**
 * Decision Trigger snapshot — injects the seller's already-derived dominant
 * Decision Trigger into the coach's per-user context, so the coaching can name
 * the trigger and weave its evidence into the conversation instead of
 * re-deriving it. Read-only and deterministic; returns '' on any failure so a
 * trigger outage never blocks the chat (same contract as buildMemorySnapshot).
 *
 * Source table: decision_triggers (written by the identify-decision-trigger fn).
 * The request-scoped client carries the user's JWT, so RLS enforces isolation;
 * the explicit user_id filter is defence in depth.
 */

// Minimal query surface (decoupled from supabase-js so the unit test can supply
// a plain mock; the real request-scoped client satisfies this structurally).
interface QueryResponse {
  data: unknown;
  error: unknown;
}
interface QueryBuilder {
  select(columns: string): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  limit(count: number): QueryBuilder;
  maybeSingle(): Promise<QueryResponse>;
}
export interface DecisionTriggerClient {
  from(table: string): QueryBuilder;
}

interface DecisionTriggerRow {
  dominant_type: string;
  brand_anchor: string;
  evidence_phrases: unknown;
  placement_instruction: string;
}

/**
 * Build the <decision-trigger> block for the per-user system prompt. Returns the
 * latest derived trigger for the user, or '' when there is none / on failure.
 */
export async function buildDecisionTriggerSnapshot(
  client: DecisionTriggerClient,
  userId: string,
): Promise<string> {
  try {
    const { data, error } = await client
      .from('decision_triggers')
      .select('dominant_type, brand_anchor, evidence_phrases, placement_instruction')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return '';
    const row = data as DecisionTriggerRow;
    if (!row.dominant_type) return '';

    const phrases = Array.isArray(row.evidence_phrases)
      ? (row.evidence_phrases as unknown[]).filter((p): p is string => typeof p === 'string')
      : [];
    const evidenceLine = phrases.length
      ? `Evidence in their customers' own words: ${phrases.map((p) => `"${p}"`).join('; ')}.`
      : '';

    return [
      '<decision-trigger>',
      "This seller's Decision Trigger has already been derived for them: the single psychological trigger that makes their customer act. Reference it by name when it helps the coaching, and build on its evidence. Do NOT re-derive it or explain the methodology.",
      `Dominant trigger: ${row.dominant_type} (${row.brand_anchor}).`,
      evidenceLine,
      `Where it should be deployed: ${row.placement_instruction}`,
      '</decision-trigger>',
    ].filter(Boolean).join('\n');
  } catch (error) {
    console.error('[DecisionTrigger] Snapshot failed:', error);
    return '';
  }
}
