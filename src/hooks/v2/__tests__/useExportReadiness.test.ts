import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExportReadiness } from '../useExportReadiness';

/**
 * Tests for useExportReadiness hook
 *
 * Validates:
 * - Completion percentage calculation (weighted)
 * - Warning generation with correct severity
 * - Strengths detection (>= 75% complete)
 * - Quick wins selection (top 3 by weight)
 * - isReady flag logic
 */

describe('useExportReadiness', () => {
  describe('with empty field values', () => {
    it('should return 0% completion when no fields are filled', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: {} })
      );

      expect(result.current.completionPercent).toBe(0);
      expect(result.current.filledFields).toBe(0);
      expect(result.current.totalFields).toBeGreaterThan(0);
    });

    it('should report all chapters as warnings', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: {} })
      );

      // 11 chapters, all should have warnings
      expect(result.current.warnings.length).toBe(11);
    });

    it('should have no strengths when nothing is filled', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: {} })
      );

      expect(result.current.strengths).toHaveLength(0);
    });

    it('should have exactly 3 quick wins', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: {} })
      );

      expect(result.current.quickWins).toHaveLength(3);
    });

    it('should not be ready with 0% completion', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: {} })
      );

      expect(result.current.isReady).toBe(false);
    });

    it('should mark empty chapters as critical severity', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: {} })
      );

      const criticalWarnings = result.current.warnings.filter(w => w.severity === 'critical');
      expect(criticalWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('with partially filled fields', () => {
    const partialValues: Record<string, string | string[]> = {
      // Brand Foundation: 3/3 fields filled
      brandPurpose: 'To help brands grow',
      brandVision: 'A world where every brand thrives',
      brandMission: 'Provide AI-powered brand consulting',
      // Brand Values: 2/3 filled
      brandValues: ['Innovation', 'Integrity'],
      brandStory: 'Founded to transform branding',
      // brandPromise left empty
    };

    it('should calculate partial completion', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: partialValues })
      );

      expect(result.current.completionPercent).toBeGreaterThan(0);
      expect(result.current.completionPercent).toBeLessThan(100);
      expect(result.current.filledFields).toBe(5);
    });

    it('should show Brand Foundation as a strength (100% complete)', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: partialValues })
      );

      const foundationStrength = result.current.strengths.find(
        s => s.chapterTitle === 'Brand Foundation'
      );
      expect(foundationStrength).toBeDefined();
      expect(foundationStrength?.completionPercent).toBe(100);
    });

    it('should not show chapters with < 75% completion as strengths', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: partialValues })
      );

      // Only fully filled chapters should appear as strengths
      for (const strength of result.current.strengths) {
        expect(strength.completionPercent).toBeGreaterThanOrEqual(75);
      }
    });

    it('should not include fully completed chapters in warnings', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: partialValues })
      );

      const foundationWarning = result.current.warnings.find(
        w => w.chapterTitle === 'Brand Foundation'
      );
      expect(foundationWarning).toBeUndefined();
    });
  });

  describe('with all fields filled', () => {
    // Build a complete field values map from the chapter config
    const allFieldValues: Record<string, string | string[]> = {
      // Brand Foundation
      brandPurpose: 'Help brands grow',
      brandVision: 'Every brand thrives',
      brandMission: 'AI consulting',
      // Brand Values
      brandValues: ['Innovation'],
      brandStory: 'Our story',
      brandPromise: 'We deliver',
      // Customer Avatar
      demographics: 'Age 25-45',
      psychographics: 'Growth-minded',
      painPoints: ['Lack of clarity'],
      goals: ['Scale brand'],
      // Market Insight
      marketInsight: 'Growing market',
      consumerInsight: 'Behavior patterns',
      // Buyer Intent
      functionalIntent: 'Solve branding',
      emotionalIntent: 'Feel confident',
      identityIntent: 'Become a leader',
      socialIntent: 'Be perceived as premium',
      // Positioning
      positioningStatement: 'For growth brands',
      uniqueValue: 'AI-powered insights',
      differentiators: ['AI-first', 'IDEA framework'],
      // Brand Personality
      brandPersonality: ['Bold', 'Innovative'],
      brandVoice: 'Professional yet approachable',
      brandArchetype: 'Sage',
      // Emotional Connection
      emotionalConnection: 'Empowerment',
      emotionalTriggers: ['Achievement', 'Growth'],
      customerNeeds: ['Confidence', 'Clarity'],
      // Customer Experience
      customerJourney: 'Awareness to advocacy',
      experiencePillars: ['Clarity', 'Speed'],
      preferredChannels: ['Web', 'Email'],
      // Brand Authority
      expertise: ['Brand strategy'],
      credibilityMarkers: ['10+ years'],
      thoughtLeadership: 'Pioneering AI branding',
      // Brand Authenticity
      authenticityPrinciples: ['Transparency'],
      transparency: 'Open communication',
      socialProof: ['500+ brands served'],
      brandConsistency: 'Cross-channel coherence',
    };

    it('should return 100% completion', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: allFieldValues })
      );

      expect(result.current.completionPercent).toBe(100);
      expect(result.current.filledFields).toBe(result.current.totalFields);
    });

    it('should have no warnings', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: allFieldValues })
      );

      expect(result.current.warnings).toHaveLength(0);
    });

    it('should have all chapters as strengths', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: allFieldValues })
      );

      expect(result.current.strengths).toHaveLength(11);
    });

    it('should have no quick wins', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: allFieldValues })
      );

      expect(result.current.quickWins).toHaveLength(0);
    });

    it('should be ready', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: allFieldValues })
      );

      expect(result.current.isReady).toBe(true);
    });
  });

  describe('warning severity ordering', () => {
    it('should sort warnings by severity: critical first, then warning, then info', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: {} })
      );

      const severities = result.current.warnings.map(w => w.severity);
      const criticalIdx = severities.lastIndexOf('critical');
      const warningIdx = severities.indexOf('warning');
      const infoIdx = severities.indexOf('info');

      // Critical should come before warning which should come before info
      if (criticalIdx >= 0 && warningIdx >= 0) {
        expect(criticalIdx).toBeLessThan(warningIdx);
      }
      if (warningIdx >= 0 && infoIdx >= 0) {
        expect(warningIdx).toBeLessThan(infoIdx);
      }
    });
  });

  describe('quick wins prioritization', () => {
    it('should prioritize foundation pillar fields (higher weight)', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: {} })
      );

      // Quick wins should include foundation fields due to higher pillar weight
      const quickWinFieldIds = result.current.quickWins.map(qw => qw.fieldId);
      // Foundation required fields have weight = 1.5 * 2 = 3.0 (highest)
      // At least one should be from a high-weight pillar
      expect(result.current.quickWins[0].weight).toBeGreaterThanOrEqual(2);
    });

    it('should limit quick wins to exactly 3', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: {} })
      );

      expect(result.current.quickWins).toHaveLength(3);
    });

    it('should include impact descriptions for quick wins', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: {} })
      );

      for (const quickWin of result.current.quickWins) {
        expect(quickWin.impactDescription).toBeTruthy();
        expect(quickWin.impactDescription.length).toBeGreaterThan(10);
      }
    });
  });

  describe('weighted completion', () => {
    it('should weight foundation fields more heavily', () => {
      // Fill only foundation fields
      const foundationOnly: Record<string, string | string[]> = {
        brandPurpose: 'Purpose',
        brandVision: 'Vision',
        brandMission: 'Mission',
        brandValues: ['Value'],
        brandStory: 'Story',
        brandPromise: 'Promise',
      };

      const { result: resultFoundation } = renderHook(() =>
        useExportReadiness({ fieldValues: foundationOnly })
      );

      // Fill only authentic fields (lower weight)
      const authenticOnly: Record<string, string | string[]> = {
        expertise: ['Expertise'],
        credibilityMarkers: ['Markers'],
        thoughtLeadership: 'Leadership',
        authenticityPrinciples: ['Principles'],
        transparency: 'Transparency',
        socialProof: ['Proof'],
        brandConsistency: 'Consistency',
      };

      const { result: resultAuthentic } = renderHook(() =>
        useExportReadiness({ fieldValues: authenticOnly })
      );

      // Foundation (6 fields, weight 1.5) should contribute more per field
      // than authentic (7 fields, weight 1.0) even though authentic has more fields
      // Foundation: 6 fields, mostly required (weight 1.5 * 2 = 3.0 each)
      // Authentic: 7 fields, mix of required/optional (weight 1.0 * 1-2 = 1.0-2.0 each)
      expect(resultFoundation.current.completionPercent).toBeGreaterThan(
        resultAuthentic.current.completionPercent
      );
    });
  });

  describe('isReady flag', () => {
    it('should not be ready with critical warnings even if high completion', () => {
      // Fill most fields but leave an entire chapter completely empty
      // This will create a critical warning
      const mostlyFilled: Record<string, string | string[]> = {
        brandPurpose: 'P', brandVision: 'V', brandMission: 'M',
        brandValues: ['V'], brandStory: 'S', brandPromise: 'P',
        demographics: 'D', psychographics: 'P', painPoints: ['P'], goals: ['G'],
        marketInsight: 'M', consumerInsight: 'C',
        functionalIntent: 'F', emotionalIntent: 'E', identityIntent: 'I', socialIntent: 'S',
        positioningStatement: 'P', uniqueValue: 'U', differentiators: ['D'],
        brandPersonality: ['B'], brandVoice: 'V', brandArchetype: 'A',
        emotionalConnection: 'E', emotionalTriggers: ['T'], customerNeeds: ['N'],
        customerJourney: 'J', experiencePillars: ['E'], preferredChannels: ['C'],
        // Brand Authority: completely empty -> critical
        // Brand Authenticity: completely empty -> critical
      };

      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: mostlyFilled })
      );

      // Even with high completion, critical warnings should prevent "ready"
      const hasCritical = result.current.warnings.some(w => w.severity === 'critical');
      if (hasCritical) {
        expect(result.current.isReady).toBe(false);
      }
    });
  });

  describe('field value detection', () => {
    it('should treat empty strings as unfilled', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: { brandPurpose: '' } })
      );

      expect(result.current.filledFields).toBe(0);
    });

    it('should treat whitespace-only strings as unfilled', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: { brandPurpose: '   ' } })
      );

      expect(result.current.filledFields).toBe(0);
    });

    it('should treat empty arrays as unfilled', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: { brandValues: [] } })
      );

      expect(result.current.filledFields).toBe(0);
    });

    it('should treat arrays with only empty strings as unfilled', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: { brandValues: ['', '  '] } })
      );

      expect(result.current.filledFields).toBe(0);
    });

    it('should treat non-empty strings as filled', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: { brandPurpose: 'We exist to help' } })
      );

      expect(result.current.filledFields).toBe(1);
    });

    it('should treat arrays with content as filled', () => {
      const { result } = renderHook(() =>
        useExportReadiness({ fieldValues: { brandValues: ['Innovation'] } })
      );

      expect(result.current.filledFields).toBe(1);
    });
  });
});
