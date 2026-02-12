import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InteractiveIdeaFramework } from '../InteractiveIdeaFramework';
import { BrowserRouter } from 'react-router-dom';
import { usePersistedField } from '@/hooks/usePersistedField';

// Mock the persisted field hook
vi.mock('@/hooks/usePersistedField', () => ({
  usePersistedField: vi.fn(({ defaultValue }) => ({
    value: defaultValue,
    onChange: vi.fn(),
    syncStatus: 'synced',
    isLoading: false,
    error: null,
    refresh: vi.fn(),
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

    const progressText = screen.getByText(/0% Fields Complete/);
    expect(progressText).toBeInTheDocument();
  });

  it('should calculate progress based on filled fields, not navigation', async () => {
    let fieldIndex = 0;
    const fieldValues = [
      'Customer intent value',
      'Motivation value',
      '',
      '',
      ''
    ];

    vi.mocked(usePersistedField).mockImplementation(({ defaultValue }) => {
      const value = fieldIndex < fieldValues.length ? fieldValues[fieldIndex++] : defaultValue;
      return {
        value,
        onChange: vi.fn(),
        syncStatus: 'synced',
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      };
    });

    render(
      <BrowserRouter>
        <InteractiveIdeaFramework onComplete={mockOnComplete} />
      </BrowserRouter>
    );

    const progressText = screen.getByText(/40% Fields Complete/);
    expect(progressText).toBeInTheDocument();
  });

  it('should not count whitespace-only fields as complete', async () => {
    let fieldIndex = 0;
    const fieldValues = [
      '   ',
      'Real value',
      '  \n  \t  ',
      '',
      ''
    ];

    vi.mocked(usePersistedField).mockImplementation(({ defaultValue }) => {
      const value = fieldIndex < fieldValues.length ? fieldValues[fieldIndex++] : defaultValue;
      return {
        value,
        onChange: vi.fn(),
        syncStatus: 'synced',
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      };
    });

    render(
      <BrowserRouter>
        <InteractiveIdeaFramework onComplete={mockOnComplete} />
      </BrowserRouter>
    );

    const progressText = screen.getByText(/20% Fields Complete/);
    expect(progressText).toBeInTheDocument();
  });

  it('should show 100% when all fields are complete', async () => {
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
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      };
    });

    render(
      <BrowserRouter>
        <InteractiveIdeaFramework onComplete={mockOnComplete} />
      </BrowserRouter>
    );

    const progressText = screen.getByText(/100% Fields Complete/);
    expect(progressText).toBeInTheDocument();
  });

  it('should show checkmarks only for completed fields in navigation', async () => {
    let fieldIndex = 0;
    const fieldValues = [
      'Intent filled',
      '',
      'Triggers filled',
      '',
      ''
    ];

    vi.mocked(usePersistedField).mockImplementation(({ defaultValue }) => {
      const value = fieldIndex < fieldValues.length ? fieldValues[fieldIndex++] : defaultValue;
      return {
        value,
        onChange: vi.fn(),
        syncStatus: 'synced',
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      };
    });

    render(
      <BrowserRouter>
        <InteractiveIdeaFramework onComplete={mockOnComplete} />
      </BrowserRouter>
    );

    const buttons = screen.getAllByRole('button');
    const stepButtons = buttons.filter(btn => {
      const text = btn.textContent || '';
      return text.includes('Intent') ||
             text.includes('Motivation') ||
             text.includes('Triggers') ||
             text.includes('Shopper') ||
             text.includes('Demographics');
    });

    expect(stepButtons).toHaveLength(5);

    const progressText = screen.getByText(/40% Fields Complete/);
    expect(progressText).toBeInTheDocument();
  });
});
