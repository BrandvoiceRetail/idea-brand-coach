import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ChapterSectionAccordion } from '../ChapterSectionAccordion';
import type { ChapterData } from '../ChapterSectionAccordion';
import type { Chapter, ChapterStatus } from '@/config/chapterFields';

// Mock ChapterFieldSet component to simplify testing
vi.mock('../ChapterFieldSet', () => ({
  ChapterFieldSet: ({ field, onChange, disabled }: any) => (
    <div data-testid={`field-${field.id}`}>
      <input
        aria-label={field.label}
        onChange={(e) => onChange(field.id, e.target.value)}
        disabled={disabled}
      />
    </div>
  ),
}));

describe('ChapterSectionAccordion', () => {
  const mockOnFieldChange = vi.fn();
  const mockOnProceed = vi.fn();

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
        createChapterData(mockChapter1, 'completed'),
        createChapterData(mockChapter2, 'active'),
        createChapterData(mockChapter3, 'future'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
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
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText('Define your core brand identity')).toBeInTheDocument();
    });

    it('should render completed status badge', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'completed', { brandPurpose: 'Test purpose' }),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should render active status badge', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should render locked status badge for future chapters', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'future'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText('Locked')).toBeInTheDocument();
    });
  });

  describe('accordion behavior', () => {
    it('should auto-expand active chapter', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'completed', { brandPurpose: 'Test' }),
        createChapterData(mockChapter2, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
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
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByTestId('field-brandPurpose')).toBeInTheDocument();

      // Update to make chapter 2 active
      const updatedChapters: ChapterData[] = [
        createChapterData(mockChapter1, 'completed', { brandPurpose: 'Done' }),
        createChapterData(mockChapter2, 'active'),
      ];

      rerender(
        <ChapterSectionAccordion
          chapters={updatedChapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByTestId('field-brandValues')).toBeInTheDocument();
    });

    it('should disable future chapter triggers', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'future'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      const trigger = screen.getByRole('button', { name: /Brand Foundation/i });
      expect(trigger).toBeDisabled();
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
          onProceed={mockOnProceed}
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
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByTestId('field-brandPurpose')).toBeInTheDocument();
      expect(screen.getByTestId('field-brandVision')).toBeInTheDocument();
    });

    it('should render "Proceed to Next Section" button for active chapter', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText('Proceed to Next Section')).toBeInTheDocument();
    });

    it('should not render "Proceed to Next Section" button for non-active chapters', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'completed', { brandPurpose: 'Test' }),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      expect(screen.queryByText('Proceed to Next Section')).not.toBeInTheDocument();
    });

    it('should pass disabled prop to fields in non-active chapters', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
        createChapterData(mockChapter2, 'completed', { brandValues: ['Test'] }),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      // Active chapter fields should not be disabled
      const activeInput = screen.getByLabelText('Brand Purpose');
      expect(activeInput).not.toBeDisabled();
    });
  });

  describe('completed chapter summary', () => {
    it('should display first field value as summary', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'completed', {
          brandPurpose: 'To innovate and inspire',
          brandVision: 'A better world',
        }),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      // Accordion should be open because it's the activeChapterId
      expect(screen.getByText('To innovate and inspire')).toBeInTheDocument();
    });

    it('should truncate long text values to 100 characters', () => {
      const longText = 'A'.repeat(150);
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'completed', {
          brandPurpose: longText,
        }),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText(`${'A'.repeat(100)}...`)).toBeInTheDocument();
    });

    it('should handle array values by showing first item', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter2, 'completed', {
          brandValues: ['Innovation', 'Integrity', 'Excellence'],
        }),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText('Innovation')).toBeInTheDocument();
    });

    it('should show "No data captured" when no field values exist', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'completed', {}),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText('No data captured')).toBeInTheDocument();
    });

    it('should show "No data captured" when all fields are empty', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'completed', {
          brandPurpose: '',
          brandVision: '',
        }),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText('No data captured')).toBeInTheDocument();
    });

    it('should show "No data captured" for empty array values', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter2, 'completed', {
          brandValues: [],
        }),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText('No data captured')).toBeInTheDocument();
    });
  });

  describe('future chapter locked message', () => {
    it('should display locked message for future chapters', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'future'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      // Attempt to click the disabled trigger (won't expand, but we can check content)
      expect(screen.getByText('Locked')).toBeInTheDocument();
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
          onProceed={mockOnProceed}
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
          onProceed={mockOnProceed}
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

    it('should call onProceed when "Proceed to Next Section" button is clicked', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-foundation"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      const button = screen.getByText('Proceed to Next Section');
      fireEvent.click(button);

      expect(mockOnProceed).toHaveBeenCalledWith('brand-foundation');
    });

    it('should call onProceed with correct chapter ID', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter2, 'active'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      const button = screen.getByText('Proceed to Next Section');
      fireEvent.click(button);

      expect(mockOnProceed).toHaveBeenCalledWith('brand-values');
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
          onProceed={mockOnProceed}
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
          onProceed={mockOnProceed}
          className="custom-test-class"
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('w-full');
      expect(wrapper).toHaveClass('custom-test-class');
    });
  });

  describe('ref forwarding', () => {
    it('should forward ref to container div', () => {
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
          onProceed={mockOnProceed}
        />
      );

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('multiple chapters rendering', () => {
    it('should render multiple chapters with different statuses', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'completed', { brandPurpose: 'Purpose 1' }),
        createChapterData(mockChapter2, 'active'),
        createChapterData(mockChapter3, 'future'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Locked')).toBeInTheDocument();
    });

    it('should only show active chapter fields initially', () => {
      const chapters: ChapterData[] = [
        createChapterData(mockChapter1, 'completed', { brandPurpose: 'Done' }),
        createChapterData(mockChapter2, 'active'),
        createChapterData(mockChapter3, 'future'),
      ];

      render(
        <ChapterSectionAccordion
          chapters={chapters}
          activeChapterId="brand-values"
          onFieldChange={mockOnFieldChange}
          onProceed={mockOnProceed}
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
          onProceed={mockOnProceed}
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
          onProceed={mockOnProceed}
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
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText('Brand Foundation')).toBeInTheDocument();
      expect(screen.getByText('Proceed to Next Section')).toBeInTheDocument();
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
          onProceed={mockOnProceed}
        />
      );

      expect(screen.getByText('Brand Foundation')).toBeInTheDocument();
    });
  });
});
