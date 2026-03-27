/**
 * useExportReadiness - Computes export readiness assessment
 *
 * Integration: Call this hook with fieldValues from useFieldExtraction.
 * Show ExportReadinessModal before calling downloadResponse.
 * Wire onExportAnyway to the existing downloadResponse action.
 */

import { useMemo } from 'react';
import {
  CHAPTER_FIELDS_MAP,
  type Chapter,
  type ChapterField,
} from '@/config/chapterFields';

// ---------------------------------------------------------------------------
// Section batch config (mirrors MarkdownExportService.SECTION_BATCHES)
// ---------------------------------------------------------------------------

interface SectionFieldMapping {
  id: string;
  label: string;
  /** Field IDs that feed this document section */
  fieldIds: string[];
  dependsOn?: string[];
}

/**
 * Maps each export document section to the brand-data fields it relies on.
 * Derived from SECTION_BATCHES in MarkdownExportService and the edge
 * function prompts that consume each field.
 */
const SECTION_FIELD_MAP: SectionFieldMapping[] = [
  {
    id: 'idea_overview',
    label: 'IDEA Framework Overview',
    fieldIds: [
      'brandPurpose', 'brandVision', 'brandMission', 'brandValues',
      'positioningStatement', 'demographics', 'psychographics',
    ],
    dependsOn: ['customer_avatar', 'brand_purpose', 'brand_positioning', 'brand_essence'],
  },
  {
    id: 'customer_avatar',
    label: 'Customer Understanding',
    fieldIds: ['demographics', 'psychographics', 'painPoints', 'goals'],
  },
  {
    id: 'emotional_triggers',
    label: 'Emotional Triggers',
    fieldIds: ['emotionalConnection', 'emotionalTriggers', 'customerNeeds'],
  },
  {
    id: 'customer_journey',
    label: 'Customer Journey',
    fieldIds: ['customerJourney', 'experiencePillars', 'preferredChannels'],
  },
  {
    id: 'brand_purpose',
    label: 'Brand Purpose & Vision',
    fieldIds: ['brandPurpose', 'brandVision', 'brandMission'],
  },
  {
    id: 'brand_mission',
    label: 'Brand Mission & Values',
    fieldIds: ['brandMission', 'brandValues', 'brandPromise'],
  },
  {
    id: 'brand_positioning',
    label: 'Brand Positioning',
    fieldIds: ['positioningStatement', 'uniqueValue', 'differentiators'],
  },
  {
    id: 'brand_personality',
    label: 'Brand Personality & Voice',
    fieldIds: ['brandPersonality', 'brandVoice', 'brandArchetype'],
  },
  {
    id: 'brand_essence',
    label: 'Brand Essence & DNA',
    fieldIds: [
      'brandPurpose', 'brandMission', 'positioningStatement',
      'brandPersonality', 'brandVoice',
    ],
    dependsOn: ['brand_purpose', 'brand_mission', 'brand_positioning', 'brand_personality'],
  },
  {
    id: 'brand_story',
    label: 'Brand Story',
    fieldIds: ['brandStory', 'brandValues', 'brandPromise', 'brandPurpose'],
  },
  {
    id: 'messaging_framework',
    label: 'Messaging Framework',
    fieldIds: [
      'positioningStatement', 'uniqueValue', 'brandVoice',
      'emotionalConnection', 'demographics',
    ],
  },
  {
    id: 'agentic_commerce',
    label: 'Agentic Commerce',
    fieldIds: [
      'functionalIntent', 'emotionalIntent', 'identityIntent', 'socialIntent',
      'marketInsight', 'consumerInsight',
    ],
  },
  {
    id: 'implementation',
    label: 'Implementation Roadmap',
    fieldIds: [
      'expertise', 'credibilityMarkers', 'authenticityPrinciples',
      'transparency', 'socialProof', 'brandConsistency',
    ],
    dependsOn: ['brand_essence'],
  },
];

// ---------------------------------------------------------------------------
// Weight configuration
// ---------------------------------------------------------------------------

/** Fields that get elevated weight in the overall score. */
const FIELD_WEIGHTS: Record<string, number> = {
  // 3x — foundation for synthesis
  brandPurpose: 3,
  brandVision: 3,
  brandMission: 3,
  // 2x — positioning & avatar demographics
  positioningStatement: 2,
  demographics: 2,
  psychographics: 2,
};

const DEFAULT_WEIGHT = 1;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ExportReadiness {
  overallPercent: number;
  sectionReadiness: SectionScore[];
  warnings: ReadinessWarning[];
  strengths: string[];
  quickWins: QuickWin[];
}

export interface SectionScore {
  sectionId: string;
  sectionLabel: string;
  percent: number;
  fieldsFilled: number;
  fieldsTotal: number;
}

export interface ReadinessWarning {
  severity: 'info' | 'warning' | 'critical';
  section: string;
  missingFields: string[];
  impact: string;
}

export interface QuickWin {
  fieldId: string;
  fieldLabel: string;
  chapterId: string;
  impact: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a flat lookup: fieldId -> { field, chapter } */
function buildFieldLookup(): Map<string, { field: ChapterField; chapter: Chapter }> {
  const lookup = new Map<string, { field: ChapterField; chapter: Chapter }>();
  for (const chapter of Object.values(CHAPTER_FIELDS_MAP)) {
    for (const field of chapter.fields) {
      lookup.set(field.id, { field, chapter });
    }
  }
  return lookup;
}

function isFieldFilled(value: string | string[] | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0 && value.some(v => v.trim().length > 0);
  return typeof value === 'string' && value.trim().length > 0;
}

function severityForField(fieldId: string): 'critical' | 'warning' | 'info' {
  const weight = FIELD_WEIGHTS[fieldId] ?? DEFAULT_WEIGHT;
  if (weight >= 3) return 'critical';
  if (weight >= 2) return 'warning';
  return 'info';
}

function impactTextForSection(sectionLabel: string, missingCount: number, totalCount: number): string {
  if (missingCount === totalCount) {
    return `${sectionLabel} section will contain placeholder guidance instead of your specific brand direction`;
  }
  return `${sectionLabel} section will be partially generated — some content will use generic guidance`;
}

function impactTextForQuickWin(fieldLabel: string, sectionLabels: string[]): string {
  if (sectionLabels.length === 0) return `Completing ${fieldLabel} improves your overall brand strategy`;
  if (sectionLabels.length === 1) return `Feeds into ${sectionLabels[0]}`;
  return `Feeds into ${sectionLabels.slice(0, 2).join(' and ')}${sectionLabels.length > 2 ? ` (+${sectionLabels.length - 2} more)` : ''}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useExportReadiness(
  fieldValues: Record<string, string | string[]>
): ExportReadiness {
  return useMemo(() => computeReadiness(fieldValues), [fieldValues]);
}

/**
 * Pure computation — separated for testability.
 */
export function computeReadiness(
  fieldValues: Record<string, string | string[]>
): ExportReadiness {
  const fieldLookup = buildFieldLookup();

  // -- Overall percent (weighted) --
  let weightedFilled = 0;
  let weightedTotal = 0;

  for (const [fieldId] of fieldLookup) {
    const weight = FIELD_WEIGHTS[fieldId] ?? DEFAULT_WEIGHT;
    weightedTotal += weight;
    if (isFieldFilled(fieldValues[fieldId])) {
      weightedFilled += weight;
    }
  }

  const overallPercent = weightedTotal > 0
    ? Math.round((weightedFilled / weightedTotal) * 100)
    : 0;

  // -- Section readiness --
  const sectionReadiness: SectionScore[] = SECTION_FIELD_MAP.map(section => {
    const uniqueFields = [...new Set(section.fieldIds)];
    const filled = uniqueFields.filter(fId => isFieldFilled(fieldValues[fId])).length;
    return {
      sectionId: section.id,
      sectionLabel: section.label,
      percent: uniqueFields.length > 0 ? Math.round((filled / uniqueFields.length) * 100) : 100,
      fieldsFilled: filled,
      fieldsTotal: uniqueFields.length,
    };
  });

  // -- Warnings --
  const warnings: ReadinessWarning[] = [];

  for (const section of SECTION_FIELD_MAP) {
    const uniqueFields = [...new Set(section.fieldIds)];
    const missing = uniqueFields.filter(fId => !isFieldFilled(fieldValues[fId]));
    if (missing.length === 0) continue;

    // Use highest severity among missing fields
    let maxSeverity: 'info' | 'warning' | 'critical' = 'info';
    for (const fId of missing) {
      const s = severityForField(fId);
      if (s === 'critical') { maxSeverity = 'critical'; break; }
      if (s === 'warning' && maxSeverity !== 'critical') maxSeverity = 'warning';
    }

    warnings.push({
      severity: maxSeverity,
      section: section.label,
      missingFields: missing,
      impact: impactTextForSection(section.label, missing.length, uniqueFields.length),
    });
  }

  // Sort: critical first, then warning, then info
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // -- Strengths --
  const strengths: string[] = sectionReadiness
    .filter(s => s.percent >= 75)
    .map(s => `${s.sectionLabel} is well-developed (${s.percent}% complete)`);

  // -- Quick wins: highest-weight empty fields, top 3 --
  const emptyFields: Array<{
    fieldId: string;
    weight: number;
    field: ChapterField;
    chapter: Chapter;
    sections: string[];
  }> = [];

  for (const [fieldId, meta] of fieldLookup) {
    if (isFieldFilled(fieldValues[fieldId])) continue;

    const sections = SECTION_FIELD_MAP
      .filter(s => s.fieldIds.includes(fieldId))
      .map(s => s.label);

    emptyFields.push({
      fieldId,
      weight: FIELD_WEIGHTS[fieldId] ?? DEFAULT_WEIGHT,
      field: meta.field,
      chapter: meta.chapter,
      sections,
    });
  }

  emptyFields.sort((a, b) => b.weight - a.weight);

  const quickWins: QuickWin[] = emptyFields.slice(0, 3).map(entry => ({
    fieldId: entry.fieldId,
    fieldLabel: entry.field.label,
    chapterId: entry.chapter.id,
    impact: impactTextForQuickWin(entry.field.label, entry.sections),
  }));

  return {
    overallPercent,
    sectionReadiness,
    warnings,
    strengths,
    quickWins,
  };
}
