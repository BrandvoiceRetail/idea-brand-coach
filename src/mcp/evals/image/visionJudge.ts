/**
 * Vision judge — scores a PRODUCED image against the rubric, with the opted-in corpus as
 * ground truth. Mirrors the behavioural Judge (anthropic.ts) but the model sees the actual
 * image bytes/URL, so it can rule on policy, product fidelity, and fabricated on-image text.
 *
 * Everything is injected + deterministic-at-the-seams: the contract, the prompt builder, and
 * the verdict parser live here and are unit-tested with a mock; the real Anthropic-vision impl
 * is gated on ANTHROPIC_API_KEY. The rubric aggregation stays in rubric.ts.
 */
import type { ImageEvalCase } from './cases.js';
import type { ImageVerdict, RubricDimension } from './rubric.js';
import { dimensionsFor } from './rubric.js';
import { getCorpus, type OptedInBrandCorpus } from './corpus.js';

/** A produced image to score: a URL (Higgsfield output) OR inline base64 bytes. */
export interface ImageRef {
  /** https URL of the produced image (from the Higgsfield generate_image result). */
  url?: string;
  /** Inline bytes for offline/CI scoring. */
  base64?: string;
  /** MIME type for base64 (default image/png). */
  mediaType?: string;
}

export interface VisionJudge {
  judgeImage(input: {
    image: ImageRef;
    evalCase: ImageEvalCase;
    dimensions: RubricDimension[];
    corpus: OptedInBrandCorpus;
  }): Promise<ImageVerdict[]>;
}

/** Build the judge prompt: the rubric questions + the corpus ground truth for this case. */
export function buildVisionJudgePrompt(evalCase: ImageEvalCase, dimensions: RubricDimension[], corpus: OptedInBrandCorpus): string {
  return [
    `You are scoring a PRODUCED image deliverable for an Amazon seller. Deliverable type: ${evalCase.deliverable}.`,
    `Intent: ${evalCase.intent}`,
    `A passing image looks like: ${evalCase.passLooksLike}`,
    '',
    'GROUND TRUTH — the seller\'s real, opted-in brand data (score the image against THIS, not a hypothetical):',
    `- Brand / product: ${corpus.brand} — ${corpus.product} (${corpus.price})`,
    `- Core problem the image must move: ${corpus.coreProblem}`,
    `- Weakest Trust Gap pillar: ${corpus.positioning.trustGapPillar} — ${corpus.positioning.trustGapSummary}`,
    `- Decision Trigger to lead with: ${corpus.positioning.decisionTrigger} (anchor: ${corpus.positioning.anchor})`,
    `- Avatar felt experience: ${corpus.reviewVoice.feltExperience}`,
    `- Rivals it must beat in the grid: ${corpus.rivals.join(', ')}`,
    `- VERIFIED facts the image MAY state: ${corpus.verifiedFacts.join('; ')}`,
    `- PROHIBITED / fabricated claims the image must NOT state: ${corpus.prohibitedClaims.join('; ')}`,
    '',
    'Score EACH dimension 0..1 (1 = fully meets it) and pass/fail. A hard-gate dimension (policy, product fidelity, fabricated claims) fails the moment there is ANY violation, however good the rest looks.',
    'Dimensions:',
    ...dimensions.map((d) => `- ${d.id}${d.hard ? ' [HARD]' : ''}: ${d.question}`),
    '',
    'Return ONLY a JSON array of {"dimension","score","pass","rationale"}. No prose outside the JSON.',
  ].join('\n');
}

/** Parse the judge's JSON; any missing dimension defaults to a conservative fail (score 0). */
export function parseImageVerdicts(text: string, dimensions: RubricDimension[]): ImageVerdict[] {
  let parsed: unknown = [];
  const m = text.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      parsed = [];
    }
  }
  const arr = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  return dimensions.map((d) => {
    const v = arr.find((x) => x.dimension === d.id);
    const score = typeof v?.score === 'number' ? Math.max(0, Math.min(1, v.score)) : 0;
    return {
      dimension: d.id,
      score,
      pass: typeof v?.pass === 'boolean' ? v.pass : score >= 0.6,
      rationale: typeof v?.rationale === 'string' ? v.rationale : 'No verdict returned for this dimension (conservative fail).',
    };
  });
}

const VISION_JUDGE_SYSTEM =
  'You are a strict, sceptical reviewer of Amazon product imagery. You judge the IMAGE you are shown against a rubric and the seller\'s real brand data. You fail hard gates (Amazon policy, product fidelity, fabricated claims) on any violation, even if the image is beautiful — a policy break or a fabricated claim makes the deliverable worthless or harmful. Return ONLY the JSON array requested.';

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_VISION_MODEL = 'claude-sonnet-4-6';

interface ContentBlock {
  type: string;
  text?: string;
  source?: { type: 'url' | 'base64'; url?: string; media_type?: string; data?: string };
}

/** Build the Anthropic image content block from a URL or inline base64. */
export function imageContentBlock(image: ImageRef): ContentBlock {
  if (image.url) return { type: 'image', source: { type: 'url', url: image.url } };
  if (image.base64) {
    return { type: 'image', source: { type: 'base64', media_type: image.mediaType ?? 'image/png', data: image.base64 } };
  }
  throw new Error('ImageRef must carry a url or base64.');
}

/** Real, gated Anthropic-vision judge. Throws without ANTHROPIC_API_KEY. */
export function createAnthropicVisionJudge(opts: { apiKey: string; model?: string }): VisionJudge {
  const model = opts.model ?? DEFAULT_VISION_MODEL;
  return {
    async judgeImage({ image, evalCase, dimensions, corpus }): Promise<ImageVerdict[]> {
      const prompt = buildVisionJudgePrompt(evalCase, dimensions, corpus);
      const base = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
      const res = await fetch(`${base}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: VISION_JUDGE_SYSTEM,
          messages: [{ role: 'user', content: [imageContentBlock(image), { type: 'text', text: prompt }] }],
        }),
      });
      if (!res.ok) {
        throw new Error(`Anthropic vision API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      const json = (await res.json()) as { content: ContentBlock[] };
      const text = (json.content ?? []).filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('');
      return parseImageVerdicts(text, dimensions);
    },
  };
}

/** Convenience: score one case's produced image with an injected judge. */
export async function judgeCaseImage(
  evalCase: ImageEvalCase,
  image: ImageRef,
  judge: VisionJudge,
): Promise<ImageVerdict[]> {
  const corpus = getCorpus(evalCase.corpusRef);
  if (!corpus) throw new Error(`Unknown corpusRef "${evalCase.corpusRef}" for case ${evalCase.id}.`);
  const dimensions = dimensionsFor(evalCase.deliverable);
  return judge.judgeImage({ image, evalCase, dimensions, corpus });
}

/** Gated default vision judge for the CLI runner. Throws without ANTHROPIC_API_KEY. */
export function defaultVisionJudge(): VisionJudge {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY required for the image vision-judge tier.');
  }
  return createAnthropicVisionJudge({ apiKey, model: process.env.ANTHROPIC_VISION_MODEL });
}
