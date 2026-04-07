import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChapterFieldSet } from '../ChapterFieldSet';
import type { ChapterField } from '@/config/chapterFields';

describe('ChapterFieldSet', () => {
  const mockOnChange = vi.fn();

  const textField: ChapterField = {
    id: 'brandPurpose',
    label: 'Brand Purpose',
    type: 'text',
    placeholder: 'Enter your brand purpose',
    required: true,
    helpText: 'Why does your brand exist?'
  };

  const textareaField: ChapterField = {
    id: 'brandVision',
    label: 'Brand Vision',
    type: 'textarea',
    placeholder: 'Enter your brand vision',
    required: false,
    helpText: 'What future do you want to create?'
  };

  const arrayField: ChapterField = {
    id: 'brandValues',
    label: 'Core Values',
    type: 'array',
    placeholder: 'Enter your values',
    required: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render text input field', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText(/Brand Purpose/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your brand purpose')).toBeInTheDocument();
    });

    it('should render textarea field', () => {
      render(
        <ChapterFieldSet
          field={textareaField}
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByLabelText(/Brand Vision/);
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should render array field as textarea', () => {
      render(
        <ChapterFieldSet
          field={arrayField}
          value={[]}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByLabelText(/Core Values/);
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should display help text when provided', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Why does your brand exist?')).toBeInTheDocument();
    });

    it('should not display help text when not provided', () => {
      const fieldWithoutHelp = { ...textField, helpText: undefined };

      render(
        <ChapterFieldSet
          field={fieldWithoutHelp}
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByText('Why does your brand exist?')).not.toBeInTheDocument();
    });

    it('should show required indicator for required fields', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          onChange={mockOnChange}
        />
      );

      const label = screen.getByText('Brand Purpose');
      const requiredIndicator = label.parentElement?.querySelector('span.text-destructive');
      expect(requiredIndicator).toBeInTheDocument();
      expect(requiredIndicator?.textContent).toBe('*');
    });

    it('should not show required indicator for optional fields', () => {
      render(
        <ChapterFieldSet
          field={textareaField}
          value=""
          onChange={mockOnChange}
        />
      );

      const label = screen.getByText('Brand Vision');
      const requiredIndicator = label.parentElement?.querySelector('span.text-destructive');
      expect(requiredIndicator).not.toBeInTheDocument();
    });
  });

  describe('source indicators', () => {
    it('should render AI source badge', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          source="ai"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('AI Generated')).toBeInTheDocument();
    });

    it('should render manual source badge', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          source="manual"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Manual')).toBeInTheDocument();
    });

    it('should not render source badge when source is undefined', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByText('AI Generated')).not.toBeInTheDocument();
      expect(screen.queryByText('Manual')).not.toBeInTheDocument();
    });
  });

  describe('field values', () => {
    it('should display string value in text input', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value="To innovate and inspire"
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/Brand Purpose/) as HTMLInputElement;
      expect(input.value).toBe('To innovate and inspire');
    });

    it('should display string value in textarea', () => {
      render(
        <ChapterFieldSet
          field={textareaField}
          value="A world where everyone thrives"
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByLabelText(/Brand Vision/) as HTMLTextAreaElement;
      expect(textarea.value).toBe('A world where everyone thrives');
    });

    it('should convert array value to newline-separated string', () => {
      render(
        <ChapterFieldSet
          field={arrayField}
          value={['Innovation', 'Integrity', 'Excellence']}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByLabelText(/Core Values/) as HTMLTextAreaElement;
      expect(textarea.value).toBe('Innovation\nIntegrity\nExcellence');
    });

    it('should handle undefined value', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/Brand Purpose/) as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should handle empty string value', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/Brand Purpose/) as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should handle empty array value', () => {
      render(
        <ChapterFieldSet
          field={arrayField}
          value={[]}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByLabelText(/Core Values/) as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });
  });

  describe('onChange handling', () => {
    it('should call onChange with field id and new value for text input', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/Brand Purpose/);
      fireEvent.change(input, { target: { value: 'New purpose' } });

      expect(mockOnChange).toHaveBeenCalledWith('brandPurpose', 'New purpose');
    });

    it('should call onChange with field id and new value for textarea', () => {
      render(
        <ChapterFieldSet
          field={textareaField}
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByLabelText(/Brand Vision/);
      fireEvent.change(textarea, { target: { value: 'New vision statement' } });

      expect(mockOnChange).toHaveBeenCalledWith('brandVision', 'New vision statement');
    });

    it('should convert textarea input to array for array fields', () => {
      render(
        <ChapterFieldSet
          field={arrayField}
          value={[]}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByLabelText(/Core Values/);
      fireEvent.change(textarea, {
        target: { value: 'Innovation\nIntegrity\nExcellence' }
      });

      expect(mockOnChange).toHaveBeenCalledWith('brandValues', [
        'Innovation',
        'Integrity',
        'Excellence'
      ]);
    });

    it('should filter out empty lines in array fields', () => {
      render(
        <ChapterFieldSet
          field={arrayField}
          value={[]}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByLabelText(/Core Values/);
      fireEvent.change(textarea, {
        target: { value: 'Innovation\n\nIntegrity\n  \nExcellence\n' }
      });

      expect(mockOnChange).toHaveBeenCalledWith('brandValues', [
        'Innovation',
        'Integrity',
        'Excellence'
      ]);
    });

    it('should handle multiple onChange calls', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/Brand Purpose/);

      fireEvent.change(input, { target: { value: 'First' } });
      fireEvent.change(input, { target: { value: 'Second' } });
      fireEvent.change(input, { target: { value: 'Third' } });

      expect(mockOnChange).toHaveBeenCalledTimes(3);
      expect(mockOnChange).toHaveBeenLastCalledWith('brandPurpose', 'Third');
    });
  });

  describe('disabled state', () => {
    it('should disable text input when disabled prop is true', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          disabled={true}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/Brand Purpose/);
      expect(input).toBeDisabled();
    });

    it('should disable textarea when disabled prop is true', () => {
      render(
        <ChapterFieldSet
          field={textareaField}
          value=""
          disabled={true}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByLabelText(/Brand Vision/);
      expect(textarea).toBeDisabled();
    });

    it('should disable array textarea when disabled prop is true', () => {
      render(
        <ChapterFieldSet
          field={arrayField}
          value={[]}
          disabled={true}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByLabelText(/Core Values/);
      expect(textarea).toBeDisabled();
    });

    it('should not disable input when disabled prop is false', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          disabled={false}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/Brand Purpose/);
      expect(input).not.toBeDisabled();
    });

    it('should not disable input when disabled prop is undefined', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/Brand Purpose/);
      expect(input).not.toBeDisabled();
    });
  });

  describe('custom className', () => {
    it('should apply custom className to container', () => {
      const { container } = render(
        <ChapterFieldSet
          field={textField}
          value=""
          className="custom-class"
          onChange={mockOnChange}
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('should merge custom className with default classes', () => {
      const { container } = render(
        <ChapterFieldSet
          field={textField}
          value=""
          className="custom-class"
          onChange={mockOnChange}
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('space-y-2');
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('field type fallback', () => {
    it('should default to text input for unknown field type', () => {
      const unknownTypeField = {
        ...textField,
        type: 'unknown' as any
      };

      render(
        <ChapterFieldSet
          field={unknownTypeField}
          value="test"
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/Brand Purpose/);
      expect(input.tagName).toBe('INPUT');
    });
  });

  describe('array field placeholder', () => {
    it('should append instruction to array field placeholder', () => {
      render(
        <ChapterFieldSet
          field={arrayField}
          value={[]}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText(/Enter your values.*One item per line/);
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('ref forwarding', () => {
    it('should forward ref to container div', () => {
      const ref = vi.fn();

      render(
        <ChapterFieldSet
          ref={ref}
          field={textField}
          value=""
          onChange={mockOnChange}
        />
      );

      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('accessibility', () => {
    it('should associate label with input using htmlFor and id', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/Brand Purpose/);
      expect(input).toHaveAttribute('id', 'brandPurpose');
    });

    it('should mark required fields with required attribute', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/Brand Purpose/);
      expect(input).toBeRequired();
    });

    it('should not mark optional fields with required attribute', () => {
      render(
        <ChapterFieldSet
          field={textareaField}
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByLabelText(/Brand Vision/);
      expect(textarea).not.toBeRequired();
    });
  });

  describe('ghost text (pending values)', () => {
    // Set viewport to desktop width so ghost text is visible (hidden on mobile via CSS)
    beforeEach(() => {
      // Note: Tailwind responsive classes (hidden md:block) are CSS-based,
      // so in JSDOM they render in DOM but aren't visually hidden.
      // We test DOM presence here; responsive hiding is a CSS concern.
    });

    it('should render ghost text overlay when pendingValue is provided and field is empty', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          pendingValue="To inspire innovation"
          onChange={mockOnChange}
        />
      );

      const ghostOverlay = screen.getByTestId('ghost-text-overlay');
      expect(ghostOverlay).toBeInTheDocument();
      expect(ghostOverlay).toHaveTextContent('To inspire innovation');
    });

    it('should render Tab-to-accept hint when ghost text is shown', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          pendingValue="To inspire innovation"
          onChange={mockOnChange}
        />
      );

      const hint = screen.getByTestId('ghost-text-hint');
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent('Tab');
    });

    it('should NOT render ghost text when field already has a value', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value="Existing value"
          pendingValue="To inspire innovation"
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByTestId('ghost-text-overlay')).not.toBeInTheDocument();
    });

    it('should NOT render ghost text when pendingValue is undefined', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByTestId('ghost-text-overlay')).not.toBeInTheDocument();
    });

    it('should NOT render ghost text for array fields that have items', () => {
      render(
        <ChapterFieldSet
          field={arrayField}
          value={['Innovation', 'Integrity']}
          pendingValue={['New Value 1', 'New Value 2']}
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByTestId('ghost-text-overlay')).not.toBeInTheDocument();
    });

    it('should render ghost text for empty array fields with pending values', () => {
      render(
        <ChapterFieldSet
          field={arrayField}
          value={[]}
          pendingValue={['Innovation', 'Integrity', 'Excellence']}
          onChange={mockOnChange}
        />
      );

      const ghostOverlay = screen.getByTestId('ghost-text-overlay');
      expect(ghostOverlay).toBeInTheDocument();
      // toHaveTextContent normalizes whitespace; newlines become spaces
      expect(ghostOverlay).toHaveTextContent('Innovation Integrity Excellence');
    });

    it('should render ghost text for textarea fields', () => {
      render(
        <ChapterFieldSet
          field={textareaField}
          value=""
          pendingValue="A world where everyone thrives"
          onChange={mockOnChange}
        />
      );

      const ghostOverlay = screen.getByTestId('ghost-text-overlay');
      expect(ghostOverlay).toBeInTheDocument();
      expect(ghostOverlay).toHaveTextContent('A world where everyone thrives');
    });

    it('should call onChange when Tab key accepts ghost value for text field', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          pendingValue="To inspire innovation"
          onChange={mockOnChange}
        />
      );

      const input = screen.getByLabelText(/Brand Purpose/);
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(mockOnChange).toHaveBeenCalledWith('brandPurpose', 'To inspire innovation');
    });

    it('should call onChange with array when Tab key accepts ghost value for array field', () => {
      render(
        <ChapterFieldSet
          field={arrayField}
          value={[]}
          pendingValue={['Innovation', 'Integrity']}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByLabelText(/Core Values/);
      fireEvent.keyDown(textarea, { key: 'Tab' });

      expect(mockOnChange).toHaveBeenCalledWith('brandValues', ['Innovation', 'Integrity']);
    });

    it('should dismiss ghost text when Escape key is pressed', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          pendingValue="To inspire innovation"
          onChange={mockOnChange}
        />
      );

      // Ghost text should be visible initially
      expect(screen.getByTestId('ghost-text-overlay')).toBeInTheDocument();

      const input = screen.getByLabelText(/Brand Purpose/);
      fireEvent.keyDown(input, { key: 'Escape' });

      // Ghost text should be dismissed
      expect(screen.queryByTestId('ghost-text-overlay')).not.toBeInTheDocument();
    });

    it('should have aria-hidden on ghost text overlay for accessibility', () => {
      render(
        <ChapterFieldSet
          field={textField}
          value=""
          pendingValue="To inspire innovation"
          onChange={mockOnChange}
        />
      );

      const ghostOverlay = screen.getByTestId('ghost-text-overlay');
      expect(ghostOverlay.parentElement).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
