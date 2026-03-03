import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldEditor } from '../field-editor';
import type { FieldConfig } from '@/types/field-metadata';

describe('FieldEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseConfig: FieldConfig = {
    fieldIdentifier: 'test-field',
    label: 'Test Field',
    placeholder: 'Enter text...',
  };

  it('should render with label and value', () => {
    render(
      <FieldEditor
        config={baseConfig}
        value="test value"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Test Field')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter text...')).toHaveValue('test value');
  });

  it('should call onChange with "manual" source when value changes', () => {
    render(
      <FieldEditor
        config={baseConfig}
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByPlaceholderText('Enter text...');
    fireEvent.change(input, { target: { value: 'new value' } });

    expect(mockOnChange).toHaveBeenCalledWith('new value', 'manual');
  });

  it('should display help text when provided', () => {
    const configWithHelp: FieldConfig = {
      ...baseConfig,
      helpText: 'This is helpful information',
    };

    render(
      <FieldEditor
        config={configWithHelp}
        value=""
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('This is helpful information')).toBeInTheDocument();
  });

  it('should show edit source badge when showEditSource is true and editSource is provided', () => {
    render(
      <FieldEditor
        config={baseConfig}
        value="test"
        onChange={mockOnChange}
        editSource="manual"
        showEditSource={true}
      />
    );

    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('should hide edit source badge when showEditSource is false', () => {
    render(
      <FieldEditor
        config={baseConfig}
        value="test"
        onChange={mockOnChange}
        editSource="manual"
        showEditSource={false}
      />
    );

    expect(screen.queryByText('Manual')).not.toBeInTheDocument();
  });

  it('should validate on blur and show error for required field', () => {
    const configWithValidation: FieldConfig = {
      ...baseConfig,
      validation: {
        type: 'text',
        required: true,
      },
    };

    render(
      <FieldEditor
        config={configWithValidation}
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByPlaceholderText('Enter text...');
    fireEvent.blur(input);

    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('should validate email format on blur', () => {
    const configWithEmail: FieldConfig = {
      ...baseConfig,
      validation: {
        type: 'email',
        required: true,
      },
    };

    render(
      <FieldEditor
        config={configWithEmail}
        value="invalid-email"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByPlaceholderText('Enter text...');
    fireEvent.blur(input);

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
  });

  it('should render as textarea when validation type is textarea', () => {
    const configWithTextarea: FieldConfig = {
      ...baseConfig,
      validation: {
        type: 'textarea',
      },
    };

    render(
      <FieldEditor
        config={configWithTextarea}
        value="long text"
        onChange={mockOnChange}
      />
    );

    const textarea = screen.getByPlaceholderText('Enter text...');
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('should render as textarea when validation type is richtext', () => {
    const configWithRichtext: FieldConfig = {
      ...baseConfig,
      validation: {
        type: 'richtext',
      },
    };

    render(
      <FieldEditor
        config={configWithRichtext}
        value="rich text content"
        onChange={mockOnChange}
      />
    );

    const textarea = screen.getByPlaceholderText('Enter text...');
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('should render input with type="email" for email validation', () => {
    const configWithEmail: FieldConfig = {
      ...baseConfig,
      validation: {
        type: 'email',
      },
    };

    render(
      <FieldEditor
        config={configWithEmail}
        value="test@example.com"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByPlaceholderText('Enter text...');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('should render input with type="url" for url validation', () => {
    const configWithUrl: FieldConfig = {
      ...baseConfig,
      validation: {
        type: 'url',
      },
    };

    render(
      <FieldEditor
        config={configWithUrl}
        value="https://example.com"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByPlaceholderText('Enter text...');
    expect(input).toHaveAttribute('type', 'url');
  });

  it('should render input with type="number" for number validation', () => {
    const configWithNumber: FieldConfig = {
      ...baseConfig,
      validation: {
        type: 'number',
      },
    };

    render(
      <FieldEditor
        config={configWithNumber}
        value="42"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByPlaceholderText('Enter text...');
    expect(input).toHaveAttribute('type', 'number');
  });

  it('should display external error when provided', () => {
    render(
      <FieldEditor
        config={baseConfig}
        value="test"
        onChange={mockOnChange}
        error="External error message"
      />
    );

    expect(screen.getByText('External error message')).toBeInTheDocument();
  });

  it('should clear validation error on change', () => {
    const configWithValidation: FieldConfig = {
      ...baseConfig,
      validation: {
        type: 'text',
        required: true,
      },
    };

    render(
      <FieldEditor
        config={configWithValidation}
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByPlaceholderText('Enter text...');

    // Trigger validation error
    fireEvent.blur(input);
    expect(screen.getByText('This field is required')).toBeInTheDocument();

    // Change value should clear error
    fireEvent.change(input, { target: { value: 'new value' } });
    expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <FieldEditor
        config={baseConfig}
        value="test"
        onChange={mockOnChange}
        disabled={true}
      />
    );

    const input = screen.getByPlaceholderText('Enter text...');
    expect(input).toBeDisabled();
  });

  it('should apply error styling when there is an error', () => {
    render(
      <FieldEditor
        config={baseConfig}
        value="test"
        onChange={mockOnChange}
        error="Error message"
      />
    );

    const input = screen.getByPlaceholderText('Enter text...');
    expect(input).toHaveClass('border-red-500');
  });

  it('should validate minLength constraint', () => {
    const configWithMinLength: FieldConfig = {
      ...baseConfig,
      validation: {
        type: 'text',
        minLength: 5,
      },
    };

    render(
      <FieldEditor
        config={configWithMinLength}
        value="abc"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByPlaceholderText('Enter text...');
    fireEvent.blur(input);

    expect(screen.getByText('Must be at least 5 characters')).toBeInTheDocument();
  });

  it('should validate maxLength constraint', () => {
    const configWithMaxLength: FieldConfig = {
      ...baseConfig,
      validation: {
        type: 'text',
        maxLength: 5,
      },
    };

    render(
      <FieldEditor
        config={configWithMaxLength}
        value="toolongtext"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByPlaceholderText('Enter text...');
    fireEvent.blur(input);

    expect(screen.getByText('Must be at most 5 characters')).toBeInTheDocument();
  });

  it('should pass through additional HTML attributes', () => {
    render(
      <FieldEditor
        config={baseConfig}
        value="test"
        onChange={mockOnChange}
        data-testid="custom-field"
      />
    );

    const container = screen.getByTestId('custom-field');
    expect(container).toBeInTheDocument();
  });

  it('should apply custom className to container', () => {
    render(
      <FieldEditor
        config={baseConfig}
        value="test"
        onChange={mockOnChange}
        className="custom-class"
      />
    );

    const input = screen.getByPlaceholderText('Enter text...');
    expect(input).toHaveClass('custom-class');
  });
});
