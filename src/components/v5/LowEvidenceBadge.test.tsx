/**
 * LowEvidenceBadge — the badge must not understate its own evidence base.
 *
 * Since the /dp/ enrichment shipped (2026-07-18) a read can be backed by Amazon's
 * "Customers say" summary, which is synthesised over the FULL review corpus. The
 * badge counts only the verbatim quotes we could pull, so without the corpus flag
 * it told the seller "only 5 reviews — provisional" for a read that actually drew
 * on all of them. That understatement is the bug these tests pin.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LOW_EVIDENCE_THRESHOLD, LowEvidenceBadge } from './LowEvidenceBadge';

describe('LowEvidenceBadge', () => {
  it('stays hidden once the corpus clears the confidence threshold', () => {
    const { container } = render(
      <LowEvidenceBadge reviewCount={LOW_EVIDENCE_THRESHOLD} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('warns that the read is provisional when only quotes back it', () => {
    render(<LowEvidenceBadge reviewCount={5} />);
    expect(screen.getByText(/only 5 reviews/i)).toBeInTheDocument();
    expect(screen.getByText(/provisional/i)).toBeInTheDocument();
  });

  it('credits Amazon\'s full-corpus summary instead of implying 5 reviews is the evidence base', () => {
    render(<LowEvidenceBadge reviewCount={5} corpusSummaryUsed />);
    const text = screen.getByText(/amazon/i).textContent ?? '';
    expect(text).toMatch(/summary of all customer reviews/i);
    // The old understatement must be gone — this is the regression that matters.
    expect(text).not.toMatch(/only 5 reviews/i);
    expect(text).not.toMatch(/provisional/i);
  });

  it('still names the quote count so the limit stays visible', () => {
    render(<LowEvidenceBadge reviewCount={5} corpusSummaryUsed variant="compact" />);
    expect(screen.getByText(/5 full reviews quoted/i)).toBeInTheDocument();
  });

  it('singularises a one-review corpus', () => {
    render(<LowEvidenceBadge reviewCount={1} corpusSummaryUsed variant="compact" />);
    expect(screen.getByText(/1 full review quoted/i)).toBeInTheDocument();
  });
});
