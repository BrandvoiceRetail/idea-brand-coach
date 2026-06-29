import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FixBreadcrumb } from '../FixBreadcrumb';

/**
 * FixBreadcrumb is the Funnel drill-down trail (map → piece → Fix). These tests
 * encode the spec's contract: per-view crumbs, every ancestor is a real button
 * that fires onCrumb, the leaf is the current (non-interactive) page, and the
 * map root shows no trail.
 */
describe('FixBreadcrumb', () => {
  it('renders nothing at the map root (the tab carries it)', () => {
    const { container } = render(<FixBreadcrumb view="map" pieceLabel={null} onCrumb={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('detail → "Funnel › {piece}" with the piece as the current page', () => {
    render(<FixBreadcrumb view="detail" pieceLabel="Amazon listing" onCrumb={vi.fn()} />);
    expect(screen.getByRole('button', { name: /funnel/i })).toBeInTheDocument();
    const leaf = screen.getByText('Amazon listing');
    expect(leaf).toHaveAttribute('aria-current', 'page');
    // The piece at detail depth is the leaf — not a navigable button.
    expect(screen.queryByRole('button', { name: /amazon listing/i })).not.toBeInTheDocument();
  });

  it('fix → "Funnel › {piece} › Fix" with Fix as the current page', () => {
    render(<FixBreadcrumb view="fix" pieceLabel="Amazon listing" onCrumb={vi.fn()} />);
    expect(screen.getByRole('button', { name: /funnel/i })).toBeInTheDocument();
    // At fix depth the piece becomes a navigable ancestor.
    expect(screen.getByRole('button', { name: /amazon listing/i })).toBeInTheDocument();
    expect(screen.getByText('Fix')).toHaveAttribute('aria-current', 'page');
  });

  it('clicking the Funnel crumb navigates up to map', () => {
    const onCrumb = vi.fn();
    render(<FixBreadcrumb view="fix" pieceLabel="Amazon listing" onCrumb={onCrumb} />);
    fireEvent.click(screen.getByRole('button', { name: /funnel/i }));
    expect(onCrumb).toHaveBeenCalledWith('map');
  });

  it('clicking the piece crumb (from fix) navigates up to detail', () => {
    const onCrumb = vi.fn();
    render(<FixBreadcrumb view="fix" pieceLabel="Amazon listing" onCrumb={onCrumb} />);
    fireEvent.click(screen.getByRole('button', { name: /amazon listing/i }));
    expect(onCrumb).toHaveBeenCalledWith('detail');
  });

  it('falls back to a safe label when the piece name is missing', () => {
    render(<FixBreadcrumb view="detail" pieceLabel={null} onCrumb={vi.fn()} />);
    expect(screen.getByText('This piece')).toBeInTheDocument();
  });
});
