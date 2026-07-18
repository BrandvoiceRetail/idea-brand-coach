import { describe, it, expect } from 'vitest';
import {
  DIMENSIONS,
  DEFAULT_MODALITY,
  clampScore,
  parseAnalysis,
  cleanCompetitors,
  formatAvatar,
  formatPositioningStatement,
  formatOurAsset,
  renderProductEvidence,
  renderUrlEvidence,
  renderReviewEvidence,
  buildReviewCorpus,
  buildSystemPrompt,
  buildUserMessage,
  buildVocSystemPrompt,
  buildVocUserMessage,
  parseVoc,
  enforceVocGrounding,
  resolveModality,
  routeModality,
  isModalityWired,
  MAX_URL_EVIDENCE_CHARS,
  type CompetitorEvidence,
  type CompetitorReview,
  type Modality,
} from '../lib';
import type { AmazonProduct } from '../../_shared/dataforseo';

/** Two grounded evidence items the gate will accept. */
function evidenceMap(): Map<string, CompetitorEvidence> {
  const ev: CompetitorEvidence[] = [
    { ref: 'asin:A1', kind: 'listing', name: 'Rival One', url: 'https://www.amazon.com/dp/A1', text: 'Title: Rival One' },
    { ref: 'asin:A2', kind: 'listing', name: 'Rival Two', url: 'https://www.amazon.com/dp/A2', text: 'Title: Rival Two' },
  ];
  return new Map(ev.map((e) => [e.ref, e]));
}

describe('canonical IDEA enum', () => {
  it('is the corrected Insight/Distinctive/Empathetic/Authentic set', () => {
    expect(DIMENSIONS).toEqual(['insight', 'distinctive', 'empathetic', 'authentic']);
  });
});

describe('touchpoint -> modality routing', () => {
  it('routes each WIRED modality to its evidence source', () => {
    expect(routeModality('marketplace-listing')).toBe('dataforseo');
    expect(routeModality('web/store-copy')).toBe('firecrawl-url');
    expect(routeModality('reviews/social-proof')).toBe('reviews');
  });

  it('routes every UNWIRED modality to the stub (so the caller emits needs_input)', () => {
    const stubbed: Modality[] = ['visual/creative', 'email/lifecycle', 'social/content', 'program/community'];
    for (const m of stubbed) {
      expect(routeModality(m)).toBe('stub');
      expect(isModalityWired(m)).toBe(false);
    }
  });

  it('isModalityWired is true exactly for the three wired modalities', () => {
    expect(isModalityWired('marketplace-listing')).toBe(true);
    expect(isModalityWired('web/store-copy')).toBe(true);
    expect(isModalityWired('reviews/social-proof')).toBe(true);
  });

  it('resolveModality keeps a recognised modality and falls back to marketplace-listing', () => {
    expect(resolveModality('reviews/social-proof')).toBe('reviews/social-proof');
    expect(resolveModality(undefined)).toBe(DEFAULT_MODALITY);
    expect(resolveModality('not-a-modality')).toBe('marketplace-listing');
    expect(resolveModality(null)).toBe('marketplace-listing');
  });
});

describe('clampScore', () => {
  it('clamps to 0-100 integers and rejects non-numbers', () => {
    expect(clampScore(50)).toBe(50);
    expect(clampScore(120)).toBe(100);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(72.6)).toBe(73);
    expect(clampScore('80')).toBeUndefined();
    expect(clampScore(NaN)).toBeUndefined();
    expect(clampScore(undefined)).toBeUndefined();
  });
});

describe('parseAnalysis', () => {
  it('parses a clean JSON object', () => {
    const parsed = parseAnalysis('{"competitors":[],"strategic_angle":"x"}');
    expect(parsed?.strategic_angle).toBe('x');
  });

  it('strips code fences', () => {
    const parsed = parseAnalysis('```json\n{"competitors":[{"name":"a"}],"strategic_angle":"y"}\n```');
    expect(Array.isArray(parsed?.competitors)).toBe(true);
  });

  it('brace-scans a competitors object out of surrounding prose', () => {
    const raw = 'Here you go: {"competitors":[{"name":"a"}],"strategic_angle":"z"} done.';
    const parsed = parseAnalysis(raw);
    expect(parsed?.strategic_angle).toBe('z');
  });

  it('returns null on garbage', () => {
    expect(parseAnalysis('not json at all')).toBeNull();
  });
});

describe('cleanCompetitors — GROUNDING GATE', () => {
  it('keeps a fully-scored, evidence-anchored competitor', () => {
    const raw = [{
      name: 'Rival One',
      idea_scores: { i: 60, d: 40, e: 70, a: 55 },
      rationale: 'Strong empathy, weak distinctiveness.',
      gap_to_our_avatar: 'We can own the distinctive angle.',
      evidence_refs: [{ kind: 'listing', ref: 'asin:A1' }],
    }];
    const out = cleanCompetitors(raw, evidenceMap());
    expect(out).toHaveLength(1);
    expect(out[0].idea_scores).toEqual({ i: 60, d: 40, e: 70, a: 55 });
    expect(out[0].evidence_refs).toEqual([{ kind: 'listing', ref: 'asin:A1' }]);
  });

  it('DROPS a competitor with no anchorable evidence ref (fabrication)', () => {
    const raw = [{
      name: 'Ghost Brand',
      idea_scores: { i: 90, d: 90, e: 90, a: 90 },
      rationale: 'invented',
      evidence_refs: [{ kind: 'listing', ref: 'asin:DOES_NOT_EXIST' }],
    }];
    expect(cleanCompetitors(raw, evidenceMap())).toHaveLength(0);
  });

  it('DROPS a competitor with no evidence_refs at all', () => {
    const raw = [{ name: 'Bare', idea_scores: { i: 1, d: 1, e: 1, a: 1 } }];
    expect(cleanCompetitors(raw, evidenceMap())).toHaveLength(0);
  });

  it('DROPS a competitor missing any of the four IDEA scores', () => {
    const raw = [{
      name: 'Rival One',
      idea_scores: { i: 60, d: 40, e: 70 }, // missing a
      evidence_refs: [{ kind: 'listing', ref: 'asin:A1' }],
    }];
    expect(cleanCompetitors(raw, evidenceMap())).toHaveLength(0);
  });

  it('accepts the insight/distinctive/empathetic/authentic score aliases', () => {
    const raw = [{
      scores: { insight: 50, distinctive: 50, empathetic: 50, authentic: 50 },
      evidence_refs: [{ ref: 'asin:A2' }],
    }];
    const out = cleanCompetitors(raw, evidenceMap());
    expect(out).toHaveLength(1);
    // name falls back to the evidence name; kind falls back to the evidence kind.
    expect(out[0].name).toBe('Rival Two');
    expect(out[0].evidence_refs[0].kind).toBe('listing');
    expect(out[0].url).toBe('https://www.amazon.com/dp/A2');
  });

  it('ignores unknown refs but keeps a competitor that also cites a real one', () => {
    const raw = [{
      name: 'Rival One',
      idea_scores: { i: 10, d: 10, e: 10, a: 10 },
      evidence_refs: [{ ref: 'asin:FAKE' }, { kind: 'listing', ref: 'asin:A1' }],
    }];
    const out = cleanCompetitors(raw, evidenceMap());
    expect(out).toHaveLength(1);
    expect(out[0].evidence_refs).toEqual([{ kind: 'listing', ref: 'asin:A1' }]);
  });

  it('returns [] when the model output is not an array', () => {
    expect(cleanCompetitors(null, evidenceMap())).toEqual([]);
    expect(cleanCompetitors({ competitors: [] }, evidenceMap())).toEqual([]);
  });
});

describe('context compaction', () => {
  it('formatAvatar renders strings and arrays, ignores empties', () => {
    const text = formatAvatar({ name: 'Casual Collector', values: ['nostalgia', ''], fears: [], desires: 'status' });
    expect(text).toContain('Avatar name: Casual Collector');
    expect(text).toContain('Core values: nostalgia');
    expect(text).not.toContain('Fears');
  });

  it('formatAvatar passes through a pre-built string', () => {
    expect(formatAvatar('already a string')).toBe('already a string');
    expect(formatAvatar(null)).toBe('');
  });

  it('formatAvatar renders the audit-asset CORE_FIELDS (Calculation Parity)', () => {
    // The same field_id keys audit-asset grounds the brand's own audit on, so a
    // competitor asset is judged against the identical avatar context.
    const text = formatAvatar({
      painPoints: 'cards slip out of flimsy binders',
      brandPromise: 'every card protected for life',
      positioningStatement: 'the collector vault',
    });
    expect(text).toContain('Pain points: cards slip out of flimsy binders');
    expect(text).toContain('Brand promise: every card protected for life');
    expect(text).toContain('Positioning statement: the collector vault');
  });

  it('formatPositioningStatement renders the Positioning Statement fields', () => {
    const text = formatPositioningStatement({ positioning_statement: 'The collector\'s vault', villain: 'flimsy binders' });
    expect(text).toContain('Positioning Statement: The collector');
    expect(text).toContain('Villain: flimsy binders');
  });

  it('formatOurAsset includes the asset and its IDEA audit scores', () => {
    const text = formatOurAsset('our listing copy', { scores: { i: 40, d: 50, e: 60, a: 70 } });
    expect(text).toContain('OUR ASSET:');
    expect(text).toContain('OUR ASSET IDEA AUDIT:');
    expect(text).toContain('40');
  });
});

describe('renderProductEvidence', () => {
  it('renders only present fields (grounding — no invented values)', () => {
    const p: AmazonProduct = { asin: 'A1', title: 'Binder', price: 19.99, currency: 'USD', bullets: ['480 cards'] };
    const text = renderProductEvidence(p);
    expect(text).toContain('Title: Binder');
    expect(text).toContain('Price: USD19.99');
    expect(text).toContain('Bullets: 480 cards');
    expect(text).not.toContain('Rating');
  });
});

describe('prompt builders', () => {
  it('system prompt carries the grounding rule and the four pillars', () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain('Do NOT invent competitors');
    expect(sys).toContain('idea_scores');
    for (const dim of DIMENSIONS) expect(sys.toLowerCase()).toContain(dim);
  });

  it('system prompt reuses the audit-asset rubric (Calculation Parity)', () => {
    const sys = buildSystemPrompt();
    // Same persona and same dimension questions audit-asset uses on the brand's
    // own asset, so a competitor asset is scored identically.
    expect(sys).toContain('You are Trevor');
    expect(sys).toContain('does the asset show it understands what really drives this customer');
    expect(sys).toContain('audit-asset');
  });

  it('user message embeds each evidence ref so scores are anchorable', () => {
    const ev = [...evidenceMap().values()];
    const msg = buildUserMessage('marketplace-listing', 'amazon_listing_bullets', ev, 'AV', 'SIG', 'OUR');
    expect(msg).toContain('ref: asin:A1');
    expect(msg).toContain('ref: asin:A2');
    expect(msg).toContain('OUR AVATAR:');
    expect(msg).toContain('marketplace-listing');
  });
});

// ── P5 modality 2: web/store-copy evidence rendering ─────────────────────────

describe('renderUrlEvidence (web/store-copy)', () => {
  it('renders title + collapsed body and only what was fetched', () => {
    const text = renderUrlEvidence('Cozy Sleep PDP', '  Our gummies\n\n   help you   sleep.  ');
    expect(text).toContain('Page title: Cozy Sleep PDP');
    expect(text).toContain('Page copy: Our gummies help you sleep.');
  });

  it('caps body length (token guard) and tolerates a missing title', () => {
    const long = 'x'.repeat(MAX_URL_EVIDENCE_CHARS + 500);
    const text = renderUrlEvidence(undefined, long);
    expect(text.startsWith('Page copy: ')).toBe(true);
    // body is capped to MAX_URL_EVIDENCE_CHARS
    expect(text.length).toBeLessThanOrEqual('Page copy: '.length + MAX_URL_EVIDENCE_CHARS);
    expect(text).not.toContain('Page title');
  });

  it('returns empty string when there is nothing to render', () => {
    expect(renderUrlEvidence(undefined, '   ')).toBe('');
  });
});

// ── P5 modality 3: reviews evidence rendering + corpus ───────────────────────

const REVIEWS: CompetitorReview[] = [
  { rating: 2, title: 'Pages bend', body: 'The pages bend and my cards slip out.', verified: true },
  { rating: 5, body: 'Holds 480 cards, brilliant for my collection.' },
];

describe('renderReviewEvidence (reviews/social-proof)', () => {
  it('renders verbatim reviews with star + title + body', () => {
    const text = renderReviewEvidence(REVIEWS);
    expect(text).toContain('★2 Pages bend — The pages bend and my cards slip out.');
    expect(text).toContain('★5 Holds 480 cards, brilliant for my collection.');
  });

  it('tolerates an empty list', () => {
    expect(renderReviewEvidence([])).toBe('');
  });
});

describe('buildReviewCorpus', () => {
  it('joins reviews into a corpus + lowercased haystack', () => {
    const { corpus, haystack } = buildReviewCorpus(REVIEWS);
    expect(corpus).toContain('Pages bend. The pages bend and my cards slip out.');
    expect(haystack).toBe(corpus.toLowerCase());
  });
});

// ── P5 VoC mining (S1 vocab + S4 objections) ─────────────────────────────────

describe('VoC prompt builders', () => {
  it('system prompt forbids invented vocabulary/quotes and names both stages', () => {
    const sys = buildVocSystemPrompt();
    expect(sys).toContain('verbatim');
    expect(sys).toContain('vocab_clusters');
    expect(sys).toContain('objections');
    expect(sys).toContain('frequency_signal');
  });

  it('user message embeds the review corpus', () => {
    expect(buildVocUserMessage('the pages bend')).toContain('the pages bend');
  });
});

describe('parseVoc', () => {
  it('parses a clean VoC object', () => {
    const p = parseVoc('{"vocab_clusters":[],"objections":[]}');
    expect(Array.isArray(p?.vocab_clusters)).toBe(true);
  });

  it('strips fences and brace-scans out of prose', () => {
    const p = parseVoc('here: ```json\n{"vocab_clusters":[{"cluster":"x"}],"objections":[]}\n```');
    expect(Array.isArray(p?.vocab_clusters)).toBe(true);
  });

  it('returns null on garbage', () => {
    expect(parseVoc('nope')).toBeNull();
  });
});

describe('enforceVocGrounding — SUBSTRING GATE', () => {
  const { haystack } = buildReviewCorpus(REVIEWS);
  const refs = [{ kind: 'review', ref: 'reviews:asin:A1' }];

  it('keeps verbatim words/quotes and drops invented ones', () => {
    const parsed = {
      vocab_clusters: [{
        cluster: 'Protection',
        // 'slip out' IS in the corpus; 'damage-proof' is NOT (invented).
        customer_words: ['slip out', 'damage-proof'],
        frequency_signal: 'High',
        why_it_matters: 'Loss aversion dominates.',
      }],
      objections: [
        // verbatim_signal IS in the corpus -> kept.
        { hesitation: 'Durability', verbatim_signal: 'pages bend', resolution: 'Show the spine in A+.' },
        // verbatim_signal NOT in the corpus -> dropped (fabricated quote).
        { hesitation: 'Smell', verbatim_signal: 'it smells of glue', resolution: '...' },
      ],
    };
    const voc = enforceVocGrounding(parsed, haystack, refs);
    expect(voc).not.toBeNull();
    expect(voc!.grounding).toBe('evidence');
    expect(voc!.evidence_refs).toEqual(refs);
    expect(voc!.vocab_clusters[0].customer_words).toEqual(['slip out']);
    expect(voc!.objections).toHaveLength(1);
    expect(voc!.objections[0].verbatim_signal).toBe('pages bend');
  });

  it('normalizes an out-of-band frequency_signal to Medium', () => {
    const parsed = {
      vocab_clusters: [{ cluster: 'X', customer_words: ['pages bend'], frequency_signal: '99%', why_it_matters: 'y' }],
      objections: [],
    };
    const voc = enforceVocGrounding(parsed, haystack, refs);
    expect(voc!.vocab_clusters[0].frequency_signal).toBe('Medium');
  });

  it('returns null when nothing survives the gate (no fabricated read)', () => {
    const parsed = {
      vocab_clusters: [{ cluster: 'X', customer_words: ['totally invented'], frequency_signal: 'High', why_it_matters: 'y' }],
      objections: [{ hesitation: 'h', verbatim_signal: 'not in corpus', resolution: 'r' }],
    };
    expect(enforceVocGrounding(parsed, haystack, refs)).toBeNull();
  });
});
