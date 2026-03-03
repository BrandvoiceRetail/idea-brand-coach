import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditSourceBadge } from '../edit-source-badge';

describe('EditSourceBadge', () => {
  it('should render manual edit source with Edit icon and blue styling', () => {
    render(<EditSourceBadge source="manual" />);

    const badge = screen.getByText('Manual');
    expect(badge).toBeInTheDocument();

    // Check for blue styling classes
    const badgeContainer = badge.closest('div');
    expect(badgeContainer).toHaveClass('text-blue-600', 'border-blue-600', 'bg-blue-50');
  });

  it('should render AI edit source with Bot icon and purple styling', () => {
    render(<EditSourceBadge source="ai" />);

    const badge = screen.getByText('AI');
    expect(badge).toBeInTheDocument();

    // Check for purple styling classes
    const badgeContainer = badge.closest('div');
    expect(badgeContainer).toHaveClass('text-purple-600', 'border-purple-600', 'bg-purple-50');
  });

  it('should apply custom className', () => {
    render(<EditSourceBadge source="manual" className="custom-class" />);

    const badge = screen.getByText('Manual');
    const badgeContainer = badge.closest('div');
    expect(badgeContainer).toHaveClass('custom-class');
  });

  it('should include gap class for icon spacing', () => {
    render(<EditSourceBadge source="manual" />);

    const badge = screen.getByText('Manual');
    const badgeContainer = badge.closest('div');
    expect(badgeContainer).toHaveClass('gap-1');
  });

  it('should render Edit icon for manual source', () => {
    const { container } = render(<EditSourceBadge source="manual" />);

    // Check that the Edit icon SVG is present
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('w-3', 'h-3');
  });

  it('should render Bot icon for AI source', () => {
    const { container } = render(<EditSourceBadge source="ai" />);

    // Check that the Bot icon SVG is present
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('w-3', 'h-3');
  });
});
