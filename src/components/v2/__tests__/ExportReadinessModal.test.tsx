import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportReadinessModal } from '../ExportReadinessModal';
import type { ExportReadiness } from '@/hooks/v2/useExportReadiness';

/**
 * Tests for ExportReadinessModal component
 *
 * Validates:
 * - Rendering of readiness data (progress, warnings, strengths, quick wins)
 * - "Export Anyway" button triggers onExportAnyway
 * - "Continue Building" button triggers onClose
 * - Quick win click triggers onQuickWinClick then closes modal
 * - Severity indicators render correctly
 */

/** Factory for creating test readiness data */
function createReadiness(overrides?: Partial<ExportReadiness>): ExportReadiness {
  return {
    completionPercent: 45,
    totalFields: 35,
    filledFields: 16,
    warnings: [
      {
        chapterId: 'brand-authority',
        chapterTitle: 'Brand Authority',
        pillar: 'authentic',
        severity: 'critical',
        message: 'Brand Authority: 3 required fields missing',
        completionPercent: 0,
        missingRequiredCount: 3,
        missingOptionalCount: 0,
      },
      {
        chapterId: 'brand-values',
        chapterTitle: 'Brand Values',
        pillar: 'foundation',
        severity: 'warning',
        message: 'Brand Values: 1 required field missing',
        completionPercent: 67,
        missingRequiredCount: 1,
        missingOptionalCount: 0,
      },
      {
        chapterId: 'brand-personality',
        chapterTitle: 'Brand Personality & Voice',
        pillar: 'distinctive',
        severity: 'info',
        message: 'Brand Personality & Voice: 1 optional field empty',
        completionPercent: 67,
        missingRequiredCount: 0,
        missingOptionalCount: 1,
      },
    ],
    strengths: [
      {
        chapterId: 'brand-foundation',
        chapterTitle: 'Brand Foundation',
        pillar: 'foundation',
        completionPercent: 100,
      },
      {
        chapterId: 'customer-avatar',
        chapterTitle: 'Customer Avatar',
        pillar: 'insight',
        completionPercent: 75,
      },
    ],
    quickWins: [
      {
        fieldId: 'expertise',
        fieldLabel: 'Areas of Expertise',
        chapterId: 'brand-authority',
        chapterTitle: 'Brand Authority',
        impactDescription: 'Domains where your brand has earned the right to lead',
        weight: 3.0,
      },
      {
        fieldId: 'brandPromise',
        fieldLabel: 'Brand Promise',
        chapterId: 'brand-values',
        chapterTitle: 'Brand Values',
        impactDescription: 'A strong brand promise sets clear customer expectations',
        weight: 2.5,
      },
      {
        fieldId: 'positioningStatement',
        fieldLabel: 'Positioning Statement',
        chapterId: 'positioning',
        chapterTitle: 'Brand Positioning',
        impactDescription: 'Your positioning statement is the strategic heart of the brand export',
        weight: 2.4,
      },
    ],
    isReady: false,
    ...overrides,
  };
}

describe('ExportReadinessModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onExportAnyway: vi.fn(),
    onQuickWinClick: vi.fn(),
    readiness: createReadiness(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the modal when isOpen is true', { timeout: 30000 }, () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByText('Export Readiness')).toBeInTheDocument();
    });

    it('should not render the modal when isOpen is false', () => {
      render(<ExportReadinessModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Export Readiness')).not.toBeInTheDocument();
    });

    it('should display the completion percentage', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByText(/16 \/ 35 fields \(45%\)/)).toBeInTheDocument();
    });

    it('should display the progress bar', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('warnings section', () => {
    it('should display all warnings', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByText('Brand Authority')).toBeInTheDocument();
      expect(screen.getByText('Brand Values')).toBeInTheDocument();
      expect(screen.getByText('Brand Personality & Voice')).toBeInTheDocument();
    });

    it('should display severity badges', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByText('critical')).toBeInTheDocument();
      expect(screen.getByText('warning')).toBeInTheDocument();
      expect(screen.getByText('info')).toBeInTheDocument();
    });

    it('should display warning messages', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByText('Brand Authority: 3 required fields missing')).toBeInTheDocument();
    });

    it('should show warnings count in header', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByText(/Sections with Gaps \(3\)/)).toBeInTheDocument();
    });
  });

  describe('strengths section', () => {
    it('should display strengths', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByText('Brand Foundation')).toBeInTheDocument();
      expect(screen.getByText('Customer Avatar')).toBeInTheDocument();
    });

    it('should display strength completion percentages', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should show strengths count in header', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByText(/Strengths \(2\)/)).toBeInTheDocument();
    });

    it('should not show strengths section when there are none', () => {
      const readiness = createReadiness({ strengths: [] });
      render(<ExportReadinessModal {...defaultProps} readiness={readiness} />);

      expect(screen.queryByText(/Strengths/)).not.toBeInTheDocument();
    });
  });

  describe('quick wins section', () => {
    it('should display quick win field labels', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByText('Areas of Expertise')).toBeInTheDocument();
      expect(screen.getByText('Brand Promise')).toBeInTheDocument();
      expect(screen.getByText('Positioning Statement')).toBeInTheDocument();
    });

    it('should display impact descriptions', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByText('Domains where your brand has earned the right to lead')).toBeInTheDocument();
    });

    it('should not show quick wins section when there are none', () => {
      const readiness = createReadiness({ quickWins: [] });
      render(<ExportReadinessModal {...defaultProps} readiness={readiness} />);

      expect(screen.queryByText('Quick Wins')).not.toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('should call onExportAnyway and onClose when "Export Anyway" is clicked', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Export Anyway'));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      expect(defaultProps.onExportAnyway).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when "Continue Building" is clicked', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Continue Building'));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      expect(defaultProps.onExportAnyway).not.toHaveBeenCalled();
    });

    it('should call onQuickWinClick with field ID when a quick win is clicked', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      // Click the first quick win item
      fireEvent.click(screen.getByText('Areas of Expertise'));

      expect(defaultProps.onQuickWinClick).toHaveBeenCalledWith('expertise');
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('ready vs not ready states', () => {
    it('should show encouraging message when ready', () => {
      const readiness = createReadiness({
        isReady: true,
        completionPercent: 85,
      });

      render(<ExportReadinessModal {...defaultProps} readiness={readiness} />);

      expect(screen.getByText(/looking strong/)).toBeInTheDocument();
    });

    it('should show gap message when not ready', () => {
      render(<ExportReadinessModal {...defaultProps} />);

      expect(screen.getByText(/has some gaps/)).toBeInTheDocument();
    });
  });

  describe('without onQuickWinClick handler', () => {
    it('should render quick wins without click behavior', () => {
      const propsWithoutHandler = {
        ...defaultProps,
        onQuickWinClick: undefined,
      };

      render(<ExportReadinessModal {...propsWithoutHandler} />);

      // Quick wins should still be visible
      expect(screen.getByText('Areas of Expertise')).toBeInTheDocument();

      // Clicking should not cause errors
      fireEvent.click(screen.getByText('Areas of Expertise'));
      // No assertion needed — just verifying no crash
    });
  });
});
