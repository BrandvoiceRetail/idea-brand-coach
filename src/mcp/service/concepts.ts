/**
 * Layer 1 (service) — concept generation (first owned asset-chain link).
 *
 * Composes the existing `idea-framework-consultant-claude` engine (the literal
 * Trevor-voiced coach) with a concept-generation instruction. The engine is called
 * VERBATIM through the EdgeFnClient; this module only builds the instruction and
 * parses the reply. IV-OS brand-canon grounding is deferred BY CAPABILITY — the
 * IV-OS canon read tools are Not Started upstream; when they ship, canon context
 * gets prepended here (consume, don't duplicate).
 */

export interface ConceptCandidate {
  title: string;
  hook: string;
  angle: string;
  rationale: string;
}

export interface ConceptRequest {
  brief: string;
  channel?: string;
  count: number;
}

export function buildConceptPrompt({ brief, channel, count }: ConceptRequest): string {
  return [
    `Generate exactly ${count} distinct marketing concept candidates for the following brief.`,
    channel ? `Target channel: ${channel}.` : '',
    `Brief: ${brief}`,
    '',
    'Respond with ONLY a JSON array (no prose before or after), where each element is',
    '{"title": string, "hook": string, "angle": string, "rationale": string}.',
    'title = concept name; hook = the one-line emotional hook; angle = the creative/positioning',
    'angle; rationale = why this concept fits the brand and audience (IDEA framework grounded).',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Extract the first JSON array embedded in a (possibly fenced / chatty) reply. */
function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf('[');
  if (start === -1) return null;
  for (let end = text.lastIndexOf(']'); end > start; end = text.lastIndexOf(']', end - 1)) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* keep shrinking */
    }
  }
  return null;
}

export function parseConcepts(text: string, count: number): ConceptCandidate[] {
  const arr = extractJsonArray(text);
  if (arr) {
    return arr
      .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
      .map((c) => ({
        title: String(c.title ?? '').trim(),
        hook: String(c.hook ?? '').trim(),
        angle: String(c.angle ?? '').trim(),
        rationale: String(c.rationale ?? '').trim(),
      }))
      .filter((c) => c.title.length > 0)
      .slice(0, count);
  }
  // Fallback: numbered-list reply ("1. Title — body")
  const items = text
    .split(/\n(?=\s*\d+[.)]\s)/)
    .map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((s) => s.length > 0);
  return items.slice(0, count).map((s) => {
    const [title, ...rest] = s.split(/[—:-]/);
    return { title: title.trim(), hook: rest.join('-').trim(), angle: '', rationale: '' };
  });
}
