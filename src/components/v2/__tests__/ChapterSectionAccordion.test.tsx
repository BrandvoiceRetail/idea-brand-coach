import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ChapterSectionAccordion } from '../ChapterSectionAccordion';
import type { ChapterData } from '../ChapterSectionAccordion';
import type { Chapter, ChapterStatus } from '@/config/chapterFields';

// Mock ChapterFieldSet component to simplify testing
vi.mock('../ChapterFieldSet', () => ({
  ChapterFieldSet: ({ field, onChange }: { field: { id: string; label: string }; onChange: (id: string, value: string) => void }) => (
    <div data-testid={`field-${field.id}`}>
      <input
        aria-label={field.label}
        onChange={(e) => onChange(field.id, e.target.value)}
      />
    </div>
  ),
}));

describe('ChapterSectionAccordion', () => {
  const mockOnFieldChange = vi.fn();

  const mockChapter1: Chapter = {
    id: 'brand-foundation',
    title: 'Brand Foundation',
    description: 'Define your core brand identity',
    pillar: 'foundation',
    order: 1,
    fields: [
      {
        id: 'brandPurpose',
        label: 'Brand Purpose',
        type: 'textarea',
        placeholder: 'Why does your brand exist?',
        required: true,
      },
      {
        id: 'brandVision',
        label: 'Brand Vision',
        type: 'textarea',
        placeholder: 'What future do you want to create?',
        required: true,
      },
    ],
  };

  const mockChapter2: Chapter = {
    id: 'brand-values',
    title: 'Brand Values',
    description: 'Establish guiding principles',
    pillar: 'foundation',
    order: 2,
    fields: [
      {
        id: 'brandValues',
        label: 'Core Values',
        type: 'array',
        placeholder: 'Enter values',
        required: true,
      },
    ],
  };

  const mockChapter3: Chapter = {
    id: 'customer-avatar',
    title: 'Customer Avatar',
    description: 'Build customer profiles',
    pillar: 'insight',
    order: 3,
    fields: [
      {
        id: 'demographics',
        label: 'Demographics',
        type: 'text',
        placeholder: 'Enter demographics',
        required: true,
      },
    ],
  };

  const createChapterData = (
    chapter: Chapter,
    status: ChapterStatus,
    fieldValues: Record<string, string | string[] | undefined> = {}
  ): ChapterData => ({
    chapter,
    status,
    fieldValues,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render all chapters', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
        createChapterData(mockChapter2, 'active'),
        createChapterData(mockChapter3, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}

        />
      );

      expect(screen.getByText('Brand Foundation')).toBeInTheDocument();
      expect(screen.getByText('Brand Values')).toBeInTheDocument();
      expect(screen.getByText('Customer Avatar')).toBeInTheDocument();
    });

    it('should display chapter descriptions', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}

        />
      );

      expect(screen.getByText('Define your core brand identity')).toBeInTheDocument();
    });

    it('should render content badge showing filled field count', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active', { brandPurpose: 'Test purpose' }),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          onFieldChange={mockOnFieldChange}
        />
      );

      // 1 of 2 fields filled
      expect(screen.getByText('1/2')).toBeInTheDocument();
    });

    it('should not render content badge when no fields are filled', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          onFieldChange={mockOnFieldChange}
        />
      );

      expect(screen.queryByText('0/2')).not.toBeInTheDocument();
    });
  });

  describe('accordion behavior', () => {
    it('should auto-expand active chapter', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active', { brandPurpose: 'Test' }),
        createChapterData(mockChapter2, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}

        />
      );

      // Active chapter should be expanded and show field
      expect(screen.getByTestId('field-brandValues')).toBeInTheDocument();
    });

    it('should update accordion when activeChapterId changes', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
        createChapterData(mockChapter2, 'future'),
      ];

      const { rerender } = render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}

        />
      );

      expect(screen.getByTestId('field-brandPurpose')).toBeInTheDocument();

      // Update to make chapter 2 active
      const updatedChapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active', { brandPurpose: 'Done' }),
        createChapterData(mockChapter2, 'active'),
      ];

      rerender(
        <ChapterSectionAccordion
          chapters={updatedChapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}

        />
      );

      expect(screen.getByTestId('field-brandValues')).toBeInTheDocument();
    });

    it('should not disable future chapter triggers (all chapters accessible)', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'future'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          onFieldChange={mockOnFieldChange}

        />
      );

      const trigger = screen.getByRole('button', { name: /Brand Foundation/i });
      expect(trigger).not.toBeDisabled();
    });

    it('should not disable active chapter triggers', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}

        />
      );

      const trigger = screen.getByRole('button', { name: /Brand Foundation/i });
      expect(trigger).not.toBeDisabled();
    });
  });

  describe('active chapter content', () => {
    it('should render ChapterFieldSet components for active chapter', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}

        />
      );

      expect(screen.getByTestId('field-brandPurpose')).toBeInTheDocument();
      expect(screen.getByTestId('field-brandVision')).toBeInTheDocument();
    });

    it('should render fields as always editable (never disabled)', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
        createChapterData(mockChapter2, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}
        />
      );

      const input = screen.getByLabelText('Brand Purpose');
      expect(input).not.toBeDisabled();
    });
  });


  describe('future chapter behavior', () => {
    it('should render future chapters without a locked badge', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'future'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          onFieldChange={mockOnFieldChange}

        />
      );

      // Future chapters are accessible — no locked badge
      expect(screen.queryByText('Locked')).not.toBeInTheDocument();
      expect(screen.getByText('Brand Foundation')).toBeInTheDocument();
    });
  });

  describe('callbacks', () => {
    it('should call onFieldChange when field value changes', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}

        />
      );

      const input = screen.getByLabelText('Brand Purpose');
      fireEvent.change(input, { target: { value: 'New purpose value' } });

      expect(mockOnFieldChange).toHaveBeenCalledWith(
        'brand-foundation',
        'brandPurpose',
        'New purpose value'
      );
    });

    it('should call onFieldChange with correct chapter and field IDs', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter2, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}

        />
      );

      const input = screen.getByLabelText('Core Values');
      fireEvent.change(input, { target: { value: 'Innovation' } });

      expect(mockOnFieldChange).toHaveBeenCalledWith(
        'brand-values',
        'brandValues',
        'Innovation'
      );
    });

  });

  describe('className prop', () => {
    it('should apply custom className to container', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
      ];

      const { container } = render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}

          className="custom-test-class"
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-test-class');
    });

    it('should merge custom className with default classes', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
      ];

      const { container } = render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}

          className="custom-test-class"
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('w-full');
      expect(wrapper).toHaveClass('custom-test-class');
    });
  });

  describe('ref forwarding', () => {
    it('should expose imperative handle with focusChapter, focusField, flashField', () => {
      const ref = vi.fn();
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          ref={ref}
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}

        />
      );

      expect(ref).toHaveBeenCalled();
      const handle = ref.mock.calls[0][0];
      expect(handle).toHaveProperty('focusChapter');
      expect(handle).toHaveProperty('focusField');
      expect(handle).toHaveProperty('flashField');
    });
  });

  describe('multiple chapters rendering', () => {
    it('should render multiple chapters with content badges', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active', { brandPurpose: 'Purpose 1' }),
        createChapterData(mockChapter2, 'active'),
        createChapterData(mockChapter3, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}
        />
      );

      // Chapter 1 has 1/2 fields filled
      expect(screen.getByText('1/2')).toBeInTheDocument();
    });

    it('should only show active chapter fields initially', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active', { brandPurpose: 'Done' }),
        createChapterData(mockChapter2, 'active'),
        createChapterData(mockChapter3, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}

        />
      );

      // Active chapter should be expanded
      expect(screen.getByTestId('field-brandValues')).toBeInTheDocument();

      // Other chapters should not show fields initially (accordion collapsed)
      expect(screen.queryByTestId('field-brandPurpose')).not.toBeInTheDocument();
      expect(screen.queryByTestId('field-demographics')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle empty chapters array', () => {
      render(
        <ChapterSectionAccordion
          chapters={[]}
          onFieldChange={mockOnFieldChange}

        />
      );

      // Should render without crashing
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should handle undefined activeChapterId', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          onFieldChange={mockOnFieldChange}

        />
      );

      // Should render without crashing
      expect(screen.getByText('Brand Foundation')).toBeInTheDocument();
    });

    it('should handle chapter with no fields', () => {
      const emptyChapter: Chapter = {
        ...mockChapter1,
        fields: [],
      };

      const chapters: ChapterData[] = [
        createChapterData(emptyChapter, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}

        />
      );

      expect(screen.getByText('Brand Foundation')).toBeInTheDocument();
    });

    it('should handle fieldSources prop', () => {
      const chapters: ChapterData[] = [
        {
          ...createChapterData(mockChapter1, 'active'),
          fieldSources: {
            brandPurpose: 'ai',
            brandVision: 'manual',
          },
        },
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}

        />
      );

      expect(screen.getByText('Brand Foundation')).toBeInTheDocument();
    });
  });
});
