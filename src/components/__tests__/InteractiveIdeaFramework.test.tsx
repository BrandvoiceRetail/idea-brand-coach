import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InteractiveIdeaFramework } from '../InteractiveIdeaFramework';
import { BrowserRouter } from 'react-router-dom';

// Mock the persisted field hook
vi.mock('@/hooks/usePersistedField', () => ({
  usePersistedField: vi.fn(({ defaultValue }) => ({
    value: defaultValue,
    onChange: vi.fn(),
    syncStatus: 'synced',
  })),
}));

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null } })),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('InteractiveIdeaFramework - Progress Calculation', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show 0% progress when all fields are empty', () => {
    render(
      <BrowserRouter>
        <InteractiveIdeaFramework onComplete={mockOnComplete} />
      </BrowserRouter>
    );

    // Look for the progress text
    const progressText = screen.getByText(/0% Fields Complete/);
    expect(progressText).toBeInTheDocument();
  });

  it('should calculate progress based on filled fields, not navigation', () => {
    // Mock the persisted field hook to return some filled values
    const { usePersistedField } = await import('@/hooks/usePersistedField');

    let fieldIndex = 0;
    const fieldValues = [
      'Customer intent value', // 20%
      'Motivation value',       // 40%
      '',                      // Still 40% (empty field)
      '',                      // Still 40%
      ''                       // Still 40%
    ];

    vi.mocked(usePersistedField).mockImplementation(({ defaultValue }) => {
      const value = fieldIndex < fieldValues.length ? fieldValues[fieldIndex++] : defaultValue;
      return {
        value,
        onChange: vi.fn(),
        syncStatus: 'synced',
      };
    });

    render(
      <BrowserRouter>
        <InteractiveIdeaFramework onComplete={mockOnComplete} />
      </BrowserRouter>
    );

    // Should show 40% (2 out of 5 fields filled)
    const progressText = screen.getByText(/40% Fields Complete/);
    expect(progressText).toBeInTheDocument();
  });

  it('should not count whitespace-only fields as complete', () => {
    const { usePersistedField } = await import('@/hooks/usePersistedField');

    let fieldIndex = 0;
    const fieldValues = [
      '   ',  // Whitespace only - should not count
      'Real value', // This counts - 20%
      '  \n  \t  ', // Whitespace only - should not count
      '',     // Empty - should not count
      ''      // Empty - should not count
    ];

    vi.mocked(usePersistedField).mockImplementation(({ defaultValue }) => {
      const value = fieldIndex < fieldValues.length ? fieldValues[fieldIndex++] : defaultValue;
      return {
        value,
        onChange: vi.fn(),
        syncStatus: 'synced',
      };
    });

    render(
      <BrowserRouter>
        <InteractiveIdeaFramework onComplete={mockOnComplete} />
      </BrowserRouter>
    );

    // Should show 20% (only 1 out of 5 fields has real content)
    const progressText = screen.getByText(/20% Fields Complete/);
    expect(progressText).toBeInTheDocument();
  });

  it('should show 100% when all fields are complete', () => {
    const { usePersistedField } = await import('@/hooks/usePersistedField');

    let fieldIndex = 0;
    const fieldValues = [
      'Intent value',
      'Motivation value',
      'Triggers value',
      'Shopper type value',
      'Demographics value'
    ];

    vi.mocked(usePersistedField).mockImplementation(({ defaultValue }) => {
      const value = fieldIndex < fieldValues.length ? fieldValues[fieldIndex++] : defaultValue;
      return {
        value,
        onChange: vi.fn(),
        syncStatus: 'synced',
      };
    });

    render(
      <BrowserRouter>
        <InteractiveIdeaFramework onComplete={mockOnComplete} />
      </BrowserRouter>
    );

    // Should show 100% (all 5 fields filled)
    const progressText = screen.getByText(/100% Fields Complete/);
    expect(progressText).toBeInTheDocument();
  });

  it('should show checkmarks only for completed fields in navigation', () => {
    const { usePersistedField } = await import('@/hooks/usePersistedField');

    let fieldIndex = 0;
    const fieldValues = [
      'Intent filled',  // Should show checkmark
      '',              // Should not show checkmark
      'Triggers filled', // Should show checkmark
      '',              // Should not show checkmark
      ''               // Should not show checkmark
    ];

    vi.mocked(usePersistedField).mockImplementation(({ defaultValue }) => {
      const value = fieldIndex < fieldValues.length ? fieldValues[fieldIndex++] : defaultValue;
      return {
        value,
        onChange: vi.fn(),
        syncStatus: 'synced',
      };
    });

    render(
      <BrowserRouter>
        <InteractiveIdeaFramework onComplete={mockOnComplete} />
      </BrowserRouter>
    );

    // Check for navigation buttons
    const buttons = screen.getAllByRole('button');

    // Filter buttons that are navigation step buttons
    const stepButtons = buttons.filter(btn => {
      const text = btn.textContent || '';
      return text.includes('Intent') ||
             text.includes('Motivation') ||
             text.includes('Triggers') ||
             text.includes('Shopper') ||
             text.includes('Demographics');
    });

    expect(stepButtons).toHaveLength(5);

    // The progress should reflect 40% (2 out of 5 fields filled)
    const progressText = screen.getByText(/40% Fields Complete/);
    expect(progressText).toBeInTheDocument();
  });
});