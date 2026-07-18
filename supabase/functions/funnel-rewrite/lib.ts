/**
 * funnel-rewrite — pure rewrite logic (Deno-free, unit-testable).
 *
 * Holds everything in the rewrite path that does NOT touch Deno/fetch/Supabase:
 * the prompt builders, the competitor-brief composer, and the tolerant JSON
 * parse. `index.ts` is the thin Deno edge entry that wires HTTP, auth and the
 * Anthropic call around these.
 *
 * Mirrors the analyzer's lib/index split (competitor-analysis-asset/lib.ts) so
 * this file imports cleanly under vitest.
 *
 * THE P4 SEAM (plan §2 step 5 / ST-4): the competitor insight's
 * `gap_to_our_avatar` + `strategic_angle` are folded INTO the rewrite brief so
 * the rewrite is an explicit countermeasure to the gap a competitor leaves open.
 *
 * GROUNDING GATE (plan §3): the rewrite is generative copy, but it must be
 * anchored to the supplied brand/avatar context and the competitor brief — it
 * never invents competitor names, prices, or quotes. The prompt forbids
 * fabricating evidence; only the supplied brief drives the angle.
 */

export interface CompetitorBrief {
  /** How a competitor falls short against our avatar (from the insight). */
  gap_to_our_avatar?: string;
  /** The single strategic angle the analyzer surfaced. */
  strategic_angle?: string;
  /** Optional competitor name(s) for context only (never invented). */
  competitor_names?: string[];
}

export interface RewriteInput {
  /** Touchpoint the asset belongs to (drives format hints). */
  touchpoint_id?: string;
  /** The asset's current copy (the baseline being rewritten). */
  current_copy?: string;
  /** Competitor-derived brief — the P4 countermeasure seam. */
  competitor_brief?: CompetitorBrief;
  /** Host-supplied avatar context (object or pre-formatted string). */
  avatar_context?: unknown;
  /** Host-supplied Positioning Statement context. */
  positioning_statement_context?: unknown;
}

export interface RewriteResult {
  /** The rewritten, on-brand copy (the countermeasure). */
  rewrite: string;
  /** A short note on the angle taken (why this beats the competitor gap). */
  angle_note: string;
}

/** Format an avatar/Positioning Statement context value into model-readable text. */
export function formatContext(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  try {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    return entries.join('\n');
  } catch {
    return '';
  }
}

/**
 * Compose the competitor-derived brief into a tagged block for the prompt. The
 * gap + strategic angle are the heart of the countermeasure (ST-4). Returns ''
 * when no competitor brief was supplied (the fn still works as a plain rewrite).
 */
export function buildCompetitorBriefBlock(brief?: CompetitorBrief): string {
  if (!brief) return '';
  const parts: string[] = [];
  if (brief.strategic_angle && brief.strategic_angle.trim()) {
    parts.push(`Strategic angle to lead with: ${brief.strategic_angle.trim()}`);
  }
  if (brief.gap_to_our_avatar && brief.gap_to_our_avatar.trim()) {
    parts.push(`The gap competitors leave open (exploit this): ${brief.gap_to_our_avatar.trim()}`);
  }
  if (brief.competitor_names && brief.competitor_names.length > 0) {
    // Context only — names come from grounded insights, never invented here.
    parts.push(`Competitors analyzed (context only, do not name them in the copy): ${brief.competitor_names.join(', ')}`);
  }
  if (parts.length === 0) return '';
  return `<competitor-brief>\n${parts.join('\n')}\n</competitor-brief>`;
}

export function buildSystemPrompt(): string {
  return [
    '<persona>',
    'You are a senior brand copywriter applying the IDEA framework (Insight-Driven, Distinctive, Empathetic, Authentic).',
    '</persona>',
    '<what-to-write>',
    'Rewrite the supplied asset copy so it directly answers the competitor brief: lead with the strategic angle and exploit the gap competitors leave open, while staying true to the brand avatar and Positioning Statement.',
    '</what-to-write>',
    '<grounding-rule>',
    'Anchor every claim to the supplied brand/avatar/Positioning Statement context and the competitor brief. Do NOT invent competitor names, prices, statistics, or customer quotes. If the context is thin, write a tighter, honest rewrite rather than padding with fabricated specifics.',
    '</grounding-rule>',
    '<voice-rules>',
    'UK English. No markdown, no asterisks, no em-dashes, no emojis, no hype words. Plain, confident sentences.',
    '</voice-rules>',
    '<output-contract>',
    'Return ONLY a JSON object (no code fences, no prose around it) of the exact shape:',
    '{ "rewrite": string, "angle_note": string }',
    'rewrite = the rewritten copy. angle_note = one or two sentences on why this beats the competitor gap.',
    '</output-contract>',
  ].join('\n');
}

export function buildUserMessage(input: RewriteInput): string {
  const avatar = formatContext(input.avatar_context);
  const positioning_statement = formatContext(input.positioning_statement_context);
  const briefBlock = buildCompetitorBriefBlock(input.competitor_brief);
  const sections: string[] = [];

  if (input.touchpoint_id) {
    sections.push(`Touchpoint: ${input.touchpoint_id}`);
  }
  if (briefBlock) {
    sections.push(briefBlock);
  }
  sections.push(
    '<current-copy>',
    (input.current_copy && input.current_copy.trim()) || '(no current copy supplied — write a fresh on-brand draft for this touchpoint)',
    '</current-copy>',
  );
  if (avatar) {
    sections.push('<avatar-context>', avatar, '</avatar-context>');
  }
  if (positioning_statement) {
    sections.push('<positioning statement-context>', positioning_statement, '</positioning statement-context>');
  }
  sections.push('Produce the rewrite now as the JSON object specified in the output contract.');
  return sections.join('\n');
}

/**
 * Tolerant parse: find the first balanced top-level JSON object in the model
 * output (mirrors the analyzer's defensive parse). Returns null when no usable
 * object with a `rewrite` string can be extracted.
 */
export function parseRewrite(raw: string): RewriteResult | null {
  if (!raw) return null;
  const text = raw.trim();
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          const obj = JSON.parse(candidate) as Record<string, unknown>;
          const rewrite = typeof obj.rewrite === 'string' ? obj.rewrite.trim() : '';
          if (!rewrite) return null;
          const angleNote = typeof obj.angle_note === 'string' ? obj.angle_note.trim() : '';
          return { rewrite, angle_note: angleNote };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
