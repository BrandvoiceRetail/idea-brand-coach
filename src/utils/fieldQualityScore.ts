/**
 * Field Quality Score — IDEA Brand Coach™
 *
 * Evaluates how much a field's content will contribute to the final
 * brand strategy document. Scores from 0–100 based on:
 *   - Content presence and length
 *   - Specificity (avoids generic/placeholder-like text)
 *   - Depth of detail (word count thresholds)
 *   - Actionability (contains concrete language)
 */

export type QualityTier = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface FieldQualityResult {
  /** Numeric score 0–100 */
  score: number;
  /** Human-readable tier */
  tier: QualityTier;
  /** Short label for display */
  label: string;
}

/** Words that signal generic/placeholder content */
const GENERIC_PATTERNS = [
  /^(test|todo|tbd|placeholder|n\/a|none|asdf|xxx)$/i,
  /^(enter|write|add|type|put|insert)\s/i,
  /^(your|my|our|the)\s+(brand|company|business)\s*$/i,
];

/** Words that signal concrete, actionable brand language */
const SPECIFICITY_SIGNALS = [
  // Quantifiers and specifics
  /\d+/,
  // Named entities (capitalized words that aren't sentence starters)
  /\s[A-Z][a-z]{2,}/,
  // Emotional language
  /\b(feel|trust|believe|inspire|empower|protect|connect|transform|aspire|confident|passionate)\b/i,
  // Audience specifics
  /\b(customers?|audience|users?|community|enthusiasts?|professionals?|players?)\b/i,
  // Differentiators
  /\b(unique|only|first|unlike|differenti|exclusive|premium|innovative)\b/i,
];

/**
 * Score a single field value for brand strategy quality.
 */
export function scoreFieldQuality(
  value: string | string[] | undefined,
): FieldQualityResult {
  // Normalize to string
  const text = Array.isArray(value) ? value.join(' ') : (value ?? '');
  const trimmed = text.trim();

  // Empty field
  if (!trimmed) {
    return { score: 0, tier: 'empty', label: '' };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Check for generic/placeholder content
  const isGeneric = GENERIC_PATTERNS.some(p => p.test(trimmed));
  if (isGeneric) {
    return { score: 10, tier: 'weak', label: 'Needs depth' };
  }

  // Base score from word count (0–50 points)
  let score = 0;
  if (wordCount >= 1) score += 10;
  if (wordCount >= 3) score += 10;
  if (wordCount >= 8) score += 10;
  if (wordCount >= 15) score += 10;
  if (wordCount >= 25) score += 10;

  // Specificity bonus (0–30 points)
  let specificityHits = 0;
  for (const pattern of SPECIFICITY_SIGNALS) {
    if (pattern.test(trimmed)) specificityHits++;
  }
  score += Math.min(specificityHits * 10, 30);

  // Sentence structure bonus (0–10 points)
  // Multiple sentences suggest more developed thinking
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 3);
  if (sentences.length >= 2) score += 5;
  if (sentences.length >= 3) score += 5;

  // Diversity bonus (0–10 points)
  // Unique words relative to total — avoids repetitive content
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const diversityRatio = uniqueWords.size / wordCount;
  if (diversityRatio >= 0.6) score += 5;
  if (diversityRatio >= 0.8) score += 5;

  // Cap at 100
  score = Math.min(score, 100);

  return {
    score,
    tier: getTier(score),
    label: getLabel(score),
  };
}

function getTier(score: number): QualityTier {
  if (score === 0) return 'empty';
  if (score < 30) return 'weak';
  if (score < 55) return 'fair';
  if (score < 80) return 'good';
  return 'strong';
}

function getLabel(score: number): string {
  if (score === 0) return '';
  if (score < 30) return 'Needs depth';
  if (score < 55) return 'Getting there';
  if (score < 80) return 'Good';
  return 'Strong';
}
