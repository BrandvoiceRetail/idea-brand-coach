import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import EvalBench from '../EvalBench';
import { EVAL_CASES } from '@/mcp/evals/cases/catalog';
import { isAdminEmail } from '@/config/admin';

describe('EvalBench (Trevor test environment)', () => {
  it('lists every curated case and details the first by default', () => {
    render(<EvalBench />);
    // the catalog sidebar shows every case title
    for (const c of EVAL_CASES) {
      expect(screen.getAllByText(c.title).length).toBeGreaterThan(0);
    }
    // the four bundled inputs + expectations + run-live are all surfaced
    expect(screen.getByText('Supplied context')).toBeInTheDocument();
    expect(screen.getByText('Seeded memory')).toBeInTheDocument();
    expect(screen.getByText('Sample uploads')).toBeInTheDocument();
    expect(screen.getByText('Practice conversation')).toBeInTheDocument();
    expect(screen.getByText('Expected outcome')).toBeInTheDocument();
    expect(screen.getByText('Run live')).toBeInTheDocument();
  });

  it('switches the detail panel when another case is selected', () => {
    render(<EvalBench />);
    const safety = EVAL_CASES.find((c) => c.persona === 'edge')!;
    // click the safety case in the sidebar
    fireEvent.click(screen.getAllByText(safety.title)[0]);
    // its expected deliverable (a refusal) is now shown in the detail panel
    expect(screen.getByText(new RegExp(safety.expected.outcome.slice(0, 20), 'i'))).toBeInTheDocument();
  });
});

describe('admin allowlist includes Trevor', () => {
  it('grants Trevor access to the bench', () => {
    expect(isAdminEmail('trevor.bradford@brandvoice.co.uk')).toBe(true);
    expect(isAdminEmail('TREVOR.BRADFORD@brandvoice.co.uk')).toBe(true);
  });
});
