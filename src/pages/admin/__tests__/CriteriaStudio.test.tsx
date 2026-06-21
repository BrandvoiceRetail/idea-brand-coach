import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import CriteriaStudio from '../CriteriaStudio';
import { DEFAULT_CRITERIA_SET } from '@/mcp/evals/criteria/catalog';

describe('CriteriaStudio (non-technical criteria authoring)', () => {
  beforeEach(() => localStorage.clear());

  it('renders the default criteria and a live steering preview', () => {
    render(<CriteriaStudio />);
    expect(screen.getByText('Criteria Studio')).toBeInTheDocument();
    // the live steering preview compiles the criteria into a directive block
    expect(screen.getByText(/How this steers the coach/i)).toBeInTheDocument();
    // a default criterion title is editable (rendered as an input value)
    const first = DEFAULT_CRITERIA_SET.criteria[0];
    expect(screen.getByDisplayValue(first.title)).toBeInTheDocument();
  });
});
