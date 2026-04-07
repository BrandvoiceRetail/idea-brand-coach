/**
 * useExportReadiness Hook
 *
 * Computes brand export readiness data by analyzing field completion
 * across all 11 IDEA framework chapters. Returns:
 * - Weighted completion percentage
 * - Section-level warnings with severity
 * - Strengths (sections >= 75% complete)
 * - Quick wins (top 3 highest-weight empty fields)
 *
 * Used by ExportReadinessModal to show a pre-export readiness report.
 */

import { useMemo } from 'react';
import { CHAPTER_FIELDS_MAP, getChaptersInOrder } from '@/config/chapterFields';
import type { Chapter, ChapterField } from '@/config/chapterFields';

// ============================================================================
// Types
// ============================================================================

/** Severity level for section warnings */
export type WarningSeverity = 'critical' | 'warning' | 'info';

/** A warning about incomplete section content */
export interface SectionWarning {
  /** Chapter that has the gap */
  chapterId: string;
  /** Chapter title for display */
  chapterTitle: string;
  /** IDEA pillar this chapter belongs to */
  pillar: string;
  /** How severe the gap is */
  severity: WarningSeverity;
  /** Human-readable description of what's missing */
  message: string;
  /** Completion percentage for this section (0-100) */
  completionPercent: number;
  /** Count of missing required fields */
  missingRequiredCount: number;
  /** Count of missing optional fields */
  missingOptionalCount: number;
}

/** A section that is at least 75% complete */
export interface SectionStrength {
  /** Chapter ID */
  chapterId: string;
  /** Chapter title */
  chapterTitle: string;
  /** IDEA pillar */
  pillar: string;
  /** Completion percentage */
  completionPercent: number;
}

/** A high-impact empty field the user can quickly fill */
export interface QuickWin {
  /** Field ID for navigation */
  fieldId: string;
  /** Field label for display */
  fieldLabel: string;
  /** Chapter this field belongs to */
  chapterId: string;
  /** Chapter title */
  chapterTitle: string;
  /** Why filling this field matters */
  impactDescription: string;
  /** Weight/importance of this field (higher = more impactful) */
  weight: number;
}

/** Complete readiness assessment returned by the hook */
export interface ExportReadiness {
  /** Weighted overall completion percentage (0-100) */
  completionPercent: number;
  /** Total fields across all chapters */
  totalFields: number;
  /** Number of filled fields */
  filledFields: number;
  /** Sections with gaps, sorted by severity */
  warnings: SectionWarning[];
  /** Sections >= 75% complete */
  strengths: SectionStrength[];
  /** Top 3 highest-weight empty fields */
  quickWins: QuickWin[];
  /** Whether brand is considered "ready" (>= 60% complete, no critical warnings) */
  isReady: boolean;
}

// ============================================================================
// Weight Configuration
// ============================================================================

/**
 * Pillar weights reflect strategic importance in the IDEA framework.
 * Foundation chapters are weighted highest because everything builds on them.
 */
const PILLAR_WEIGHTS: Record<string, number> = {
  foundation: 1.5,
  insight: 1.3,
  distinctive: 1.2,
  empathy: 1.0,
  authentic: 1.0,
};

/** Required fields count 2x toward weight */
const REQUIRED_FIELD_MULTIPLIER = 2;

/** Optional fields count 1x toward weight */
const OPTIONAL_FIELD_MULTIPLIER = 1;

/**
 * Impact descriptions for quick wins, keyed by field ID.
 * Falls back to generic description using the chapter context.
 */
const FIELD_IMPACT_DESCRIPTIONS: Record<string, string> = {
  brandPurpose: 'Your brand purpose anchors every strategic decision in the export',
  brandVision: 'A clear vision statement gives your brand document directional clarity',
  brandMission: 'The mission statement translates your purpose into actionable strategy',
  brandValues: 'Core values create consistency across all brand touchpoints',
  brandStory: 'Your brand story makes the export compelling and memorable',
  brandPromise: 'A strong brand promise sets clear customer expectations',
  demographics: 'Customer demographics ensure your strategy targets the right audience',
  psychographics: 'Psychographic data reveals the deeper motivations behind customer behavior',
  painPoints: 'Defined pain points focus your value proposition on real problems',
  goals: 'Customer goals align your brand with what matters most to your audience',
  marketInsight: 'Market analysis validates your positioning against the competitive landscape',
  consumerInsight: 'Consumer behavior insights sharpen your messaging strategy',
  positioningStatement: 'Your positioning statement is the strategic heart of the brand export',
  uniqueValue: 'A clear UVP differentiates your brand document from generic strategies',
  differentiators: 'Key differentiators prove why your brand stands apart',
  brandPersonality: 'Personality traits make your brand voice consistent and recognizable',
  brandVoice: 'A defined brand voice ensures coherent communication across channels',
  emotionalConnection: 'The emotional hook creates memorable brand experiences in the export',
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Check whether a field value is considered "filled" */
function isFieldFilled(value: string | string[] | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0 && value.some(v => v.trim().length > 0);
  return String(value).trim().length > 0;
}

/** Calculate completion percentage for a single chapter */
function computeChapterCompletion(
  chapter: Chapter,
  fieldValues: Record<string, string | string[]>
): { completionPercent: number; filledCount: number; totalCount: number; missingRequired: ChapterField[]; missingOptional: ChapterField[] } {
  const totalCount = chapter.fields.length;
  if (totalCount === 0) return { completionPercent: 100, filledCount: 0, totalCount: 0, missingRequired: [], missingOptional: [] };

  let filledCount = 0;
  const missingRequired: ChapterField[] = [];
  const missingOptional: ChapterField[] = [];

  for (const field of chapter.fields) {
    if (isFieldFilled(fieldValues[field.id])) {
      filledCount++;
    } else if (field.required) {
      missingRequired.push(field);
    } else {
      missingOptional.push(field);
    }
  }

  const completionPercent = Math.round((filledCount / totalCount) * 100);
  return { completionPercent, filledCount, totalCount, missingRequired, missingOptional };
}

/** Determine warning severity based on completion and required field gaps */
function determineSeverity(completionPercent: number, missingRequiredCount: number): WarningSeverity {
  if (completionPercent === 0) return 'critical';
  if (missingRequiredCount > 0 && completionPercent < 50) return 'critical';
  if (missingRequiredCount > 0) return 'warning';
  return 'info';
}

/** Build a human-readable warning message */
function buildWarningMessage(missingRequiredCount: number, missingOptionalCount: number, chapterTitle: string): string {
  const parts: string[] = [];
  if (missingRequiredCount > 0) {
    parts.push(`${missingRequiredCount} required field${missingRequiredCount > 1 ? 's' : ''} missing`);
  }
  if (missingOptionalCount > 0) {
    parts.push(`${missingOptionalCount} optional field${missingOptionalCount > 1 ? 's' : ''} empty`);
  }
  return `${chapterTitle}: ${parts.join(', ')}`;
}

/** Get impact description for a field, with fallback */
function getImpactDescription(fieldId: string, chapterTitle: string): string {
  return FIELD_IMPACT_DESCRIPTIONS[fieldId]
    ?? `Completing this field strengthens your ${chapterTitle} section`;
}

/** Calculate weighted field importance */
function calculateFieldWeight(field: ChapterField, pillarWeight: number): number {
  const requiredMultiplier = field.required ? REQUIRED_FIELD_MULTIPLIER : OPTIONAL_FIELD_MULTIPLIER;
  return pillarWeight * requiredMultiplier;
}

// ============================================================================
// Hook
// ============================================================================

interface UseExportReadinessParams {
  /** Current field values keyed by field ID */
  fieldValues: Record<string, string | string[]>;
}

export function useExportReadiness({ fieldValues }: UseExportReadinessParams): ExportReadiness {
  return useMemo(() => {
    const chapters = getChaptersInOrder();
    const warnings: SectionWarning[] = [];
    const strengths: SectionStrength[] = [];
    const candidateQuickWins: QuickWin[] = [];

    let totalWeightedScore = 0;
    let totalWeightedMax = 0;
    let totalFields = 0;
    let filledFields = 0;

    for (const chapter of chapters) {
      const pillarWeight = PILLAR_WEIGHTS[chapter.pillar] ?? 1.0;
      const result = computeChapterCompletion(chapter, fieldValues);

      totalFields += result.totalCount;
      filledFields += result.filledCount;

      // Weighted score: each field contributes its weight when filled
      for (const field of chapter.fields) {
        const weight = calculateFieldWeight(field, pillarWeight);
        totalWeightedMax += weight;
        if (isFieldFilled(fieldValues[field.id])) {
          totalWeightedScore += weight;
        }
      }

      // Strengths: sections >= 75% complete
      if (result.completionPercent >= 75) {
        strengths.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          pillar: chapter.pillar,
          completionPercent: result.completionPercent,
        });
      }

      // Warnings: sections with any gaps
      if (result.completionPercent < 100) {
        const severity = determineSeverity(result.completionPercent, result.missingRequired.length);
        warnings.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          pillar: chapter.pillar,
          severity,
          message: buildWarningMessage(result.missingRequired.length, result.missingOptional.length, chapter.title),
          completionPercent: result.completionPercent,
          missingRequiredCount: result.missingRequired.length,
          missingOptionalCount: result.missingOptional.length,
        });
      }

      // Quick win candidates: empty fields with their weights
      for (const field of [...result.missingRequired, ...result.missingOptional]) {
        const weight = calculateFieldWeight(field, pillarWeight);
        candidateQuickWins.push({
          fieldId: field.id,
          fieldLabel: field.label,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          impactDescription: getImpactDescription(field.id, chapter.title),
          weight,
        });
      }
    }

    // Sort warnings: critical first, then warning, then info
    const severityOrder: Record<WarningSeverity, number> = { critical: 0, warning: 1, info: 2 };
    warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Sort quick wins by weight descending, take top 3
    candidateQuickWins.sort((a, b) => b.weight - a.weight);
    const quickWins = candidateQuickWins.slice(0, 3);

    // Weighted completion percentage
    const completionPercent = totalWeightedMax > 0
      ? Math.round((totalWeightedScore / totalWeightedMax) * 100)
      : 0;

    // Ready = >= 60% complete and no critical warnings
    const hasCritical = warnings.some(w => w.severity === 'critical');
    const isReady = completionPercent >= 60 && !hasCritical;

    return {
      completionPercent,
      totalFields,
      filledFields,
      warnings,
      strengths,
      quickWins,
      isReady,
    };
  }, [fieldValues]);
}
