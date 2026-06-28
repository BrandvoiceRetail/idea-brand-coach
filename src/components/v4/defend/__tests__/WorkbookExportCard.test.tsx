import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkbookExportCard } from '../WorkbookExportCard';
import { DefendChecklist } from '../DefendChecklist';
import { buildChecklist } from '@/services/v4/defendService';
import { findTierViolations } from '@/lib/v4/megapromptParse';

const captureAlphaEvent = vi.fn();
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: (...args: unknown[]) => captureAlphaEvent(...args),
}));

describe('WorkbookExportCard', () => {
  beforeEach(() => captureAlphaEvent.mockClear());

  it('fires the export action on click', () => {
    const onExport = vi.fn();
    render(<WorkbookExportCard onExport={onExport} />);
    fireEvent.click(screen.getByTestId('v4-defend-workbook-export'));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('shows a download link only when the engine returned a real URL', () => {
    render(
      <WorkbookExportCard
        onExport={vi.fn()}
        result={{ note: 'Ready.', downloadUrl: 'https://x/wb.xlsx' }}
      />,
    );
    expect(screen.getByTestId('v4-defend-workbook-download')).toHaveAttribute(
      'href',
      'https://x/wb.xlsx',
    );
  });

  it('shows the engine note but NO link when no URL was provided (no fabricated download)', () => {
    render(<WorkbookExportCard onExport={vi.fn()} result={{ note: 'Saved.', downloadUrl: null }} />);
    expect(screen.getByTestId('v4-defend-workbook-success')).toHaveTextContent('Saved.');
    expect(screen.queryByTestId('v4-defend-workbook-download')).not.toBeInTheDocument();
  });

  it('shows an honest error state', () => {
    render(<WorkbookExportCard onExport={vi.fn()} error="The workbook engine is unreachable." />);
    expect(screen.getByTestId('v4-defend-workbook-error')).toHaveTextContent(/unreachable/i);
  });

  it('disables the button while exporting', () => {
    render(<WorkbookExportCard onExport={vi.fn()} isExporting />);
    expect(screen.getByTestId('v4-defend-workbook-export')).toBeDisabled();
  });
});

describe('DefendChecklist', () => {
  beforeEach(() => captureAlphaEvent.mockClear());

  it('renders every checklist row with its derived state and no Tier-C leak', () => {
    const items = buildChecklist(1, false);
    render(<DefendChecklist items={items} />);
    expect(screen.getByTestId('v4-defend-checklist-item-competitor')).toHaveAttribute(
      'data-state',
      'coming',
    );
    expect(screen.getByTestId('v4-defend-checklist-item-drift')).toHaveAttribute(
      'data-state',
      'attention',
    );
    for (const item of items) {
      expect(findTierViolations(`${item.label} ${item.detail}`)).toEqual([]);
    }
  });

  it('shows an honest error state', () => {
    render(<DefendChecklist error="Could not build the checklist." />);
    expect(screen.getByTestId('v4-defend-checklist-error')).toBeInTheDocument();
  });
});
