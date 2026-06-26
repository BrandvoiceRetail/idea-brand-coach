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
    'CREATIVE LEAP (the DISTINCTIVE / D pillar of IDEA): each concept must make the leap from the',
    'literal insight in the brief to an OWNABLE marketing expression the customer would never say',
    "out loud but would recognise instantly as right. Do NOT hand the brief's own words back — that",
    'is a summary, not a concept. Example: the literal "protect my collection from damage" becomes the',
    "distinctive line \"battle ready\". Borrow the customer's vocabulary; name a truth they had not.",
    'Each concept must be OWNABLE (a competitor could not credibly claim it), SURPRISING (a reframe,',
    'not a restatement), TRUE (it traces to the real insight in the brief, never to invented facts or',
    'product claims), and TESTABLE. Come at the brief from genuinely DIFFERENT angles; do not produce',
    'rewordings of one idea. Write in sharp, plain, human language — no AI filler (leverage, unlock,',
    'seamless, transformative, elevate, supercharge, game-changer).',
    '',
    'Respond with ONLY a JSON array (no prose before or after), where each element is',
    '{"title": string, "hook": string, "angle": string, "rationale": string}.',
    'title = concept name; hook = the one-line distinctive expression (the leap itself, the "battle',
    'ready"); angle = the creative/positioning angle it comes at; rationale = the real customer insight',
    'it traces to and how you would TEST whether it resonates (it is a hypothesis, not a verdict).',
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
