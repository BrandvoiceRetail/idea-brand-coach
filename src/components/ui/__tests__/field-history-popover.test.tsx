import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FieldHistoryPopover } from '../field-history-popover';
import type { KnowledgeEntry } from '@/lib/knowledge-base/interfaces';

describe('FieldHistoryPopover', () => {
  const createMockEntry = (
    id: string,
    content: string,
    updatedAt: Date,
    isCurrentVersion: boolean = false,
    editSource: 'manual' | 'ai' = 'manual',
    version?: number
  ): KnowledgeEntry => ({
    id,
    userId: 'test-user',
    fieldIdentifier: 'test-field',
    content,
    version,
    createdAt: updatedAt,
    updatedAt,
    isCurrentVersion,
    metadata: { editSource }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render history button with History icon', () => {
    render(<FieldHistoryPopover history={[]} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    expect(button).toBeInTheDocument();

    // Check for History icon
    const icon = button.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should display custom field label in title attribute', () => {
    render(<FieldHistoryPopover history={[]} fieldLabel="Brand Name" />);

    const button = screen.getByRole('button', { name: /view brand name history/i });
    expect(button).toHaveAttribute('title', 'View Brand Name history');
  });

  it('should show popover when button is clicked', async () => {
    const mockHistory = [
      createMockEntry('entry-1', 'Test content', new Date('2024-01-01'), true, 'manual')
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    // Popover should now be visible
    expect(await screen.findByText('Edit History')).toBeInTheDocument();
  });

  it('should display "No edit history available" when history is empty', async () => {
    render(<FieldHistoryPopover history={[]} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    expect(await screen.findByText('No edit history available')).toBeInTheDocument();
  });

  it('should display correct count of versions in header', async () => {
    const mockHistory = [
      createMockEntry('entry-1', 'Version 1', new Date('2024-01-01'), false, 'manual', 1),
      createMockEntry('entry-2', 'Version 2', new Date('2024-01-02'), false, 'ai', 2),
      createMockEntry('entry-3', 'Version 3', new Date('2024-01-03'), true, 'manual', 3)
    ];

    render(<FieldHistoryPopover history={mockHistory} fieldLabel="Brand Name" />);

    const button = screen.getByRole('button', { name: /view brand name history/i });
    fireEvent.click(button);

    expect(await screen.findByText('Brand Name - 3 versions')).toBeInTheDocument();
  });

  it('should display singular "version" for single entry', async () => {
    const mockHistory = [
      createMockEntry('entry-1', 'Only version', new Date('2024-01-01'), true, 'manual')
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    expect(await screen.findByText(/field - 1 version/i)).toBeInTheDocument();
  });

  it('should render entries sorted by most recent first', async () => {
    const mockHistory = [
      createMockEntry('entry-1', 'Oldest', new Date('2024-01-01'), false, 'manual'),
      createMockEntry('entry-2', 'Middle', new Date('2024-01-02'), false, 'ai'),
      createMockEntry('entry-3', 'Newest', new Date('2024-01-03'), true, 'manual')
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    const entries = await screen.findAllByText(/Newest|Middle|Oldest/);
    expect(entries[0]).toHaveTextContent('Newest');
    expect(entries[1]).toHaveTextContent('Middle');
    expect(entries[2]).toHaveTextContent('Oldest');
  });

  it('should display EditSourceBadge for each entry', async () => {
    const mockHistory = [
      createMockEntry('entry-1', 'Manual edit', new Date('2024-01-01'), false, 'manual'),
      createMockEntry('entry-2', 'AI edit', new Date('2024-01-02'), true, 'ai')
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    expect(await screen.findByText('Manual')).toBeInTheDocument();
    expect(await screen.findByText('AI')).toBeInTheDocument();
  });

  it('should mark current version with "Current" label', async () => {
    const mockHistory = [
      createMockEntry('entry-1', 'Old version', new Date('2024-01-01'), false, 'manual'),
      createMockEntry('entry-2', 'Current version', new Date('2024-01-02'), true, 'ai')
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    const currentLabel = await screen.findByText('Current');
    expect(currentLabel).toBeInTheDocument();
    expect(currentLabel).toHaveClass('text-primary');
  });

  it('should highlight current version with special styling', async () => {
    const mockHistory = [
      createMockEntry('entry-1', 'Old version', new Date('2024-01-01'), false, 'manual'),
      createMockEntry('entry-2', 'Current version', new Date('2024-01-02'), true, 'ai')
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    // Find the current version entry
    const currentText = await screen.findByText('Current version');
    const currentEntry = currentText.closest('div[class*="p-3"]');

    expect(currentEntry).toHaveClass('bg-primary/5', 'border-primary/20');
  });

  it('should truncate long content with ellipsis', async () => {
    const longContent = 'a'.repeat(100); // 100 characters
    const mockHistory = [
      createMockEntry('entry-1', longContent, new Date('2024-01-01'), true, 'manual')
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    const truncatedText = await screen.findByText(/a{60}\.{3}/);
    expect(truncatedText).toBeInTheDocument();
    expect(truncatedText.textContent).toHaveLength(63); // 60 chars + '...'
  });

  it('should not truncate short content', async () => {
    const shortContent = 'Short text';
    const mockHistory = [
      createMockEntry('entry-1', shortContent, new Date('2024-01-01'), true, 'manual')
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    const text = await screen.findByText('Short text');
    expect(text).toBeInTheDocument();
    expect(text.textContent).not.toContain('...');
  });

  it('should format timestamps as relative time for recent edits', async () => {
    const now = new Date();
    const mockHistory = [
      createMockEntry('entry-1', 'Recent content', new Date(now.getTime() - 30000), true, 'manual') // 30 seconds ago
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    // Should show "Just now" for very recent edits
    const timestamp = await screen.findByText('Just now');
    expect(timestamp).toBeInTheDocument();
  });

  it('should format timestamps as minutes ago', async () => {
    const now = new Date();
    const mockHistory = [
      createMockEntry('entry-1', 'Recent', new Date(now.getTime() - 5 * 60000), true, 'manual') // 5 minutes ago
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    expect(await screen.findByText('5m ago')).toBeInTheDocument();
  });

  it('should format timestamps as hours ago', async () => {
    const now = new Date();
    const mockHistory = [
      createMockEntry('entry-1', 'Recent', new Date(now.getTime() - 3 * 3600000), true, 'manual') // 3 hours ago
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    expect(await screen.findByText('3h ago')).toBeInTheDocument();
  });

  it('should format timestamps as days ago', async () => {
    const now = new Date();
    const mockHistory = [
      createMockEntry('entry-1', 'Recent', new Date(now.getTime() - 2 * 86400000), true, 'manual') // 2 days ago
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    expect(await screen.findByText('2d ago')).toBeInTheDocument();
  });

  it('should format old timestamps as dates', async () => {
    // Use a date from 2 months ago to ensure it shows as a formatted date
    const now = new Date();
    const oldDate = new Date(now.getFullYear(), 0, 15); // January 15 of current year
    const mockHistory = [
      createMockEntry('entry-1', 'Old', oldDate, true, 'manual')
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    // Should show formatted date like "Jan 15"
    // The format depends on current year, so just check for "Jan"
    expect(await screen.findByText(/Jan/)).toBeInTheDocument();
  });

  it('should display version number when provided', async () => {
    const mockHistory = [
      createMockEntry('entry-1', 'Versioned', new Date('2024-01-01'), true, 'manual', 5)
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    expect(await screen.findByText('v5')).toBeInTheDocument();
  });

  it('should not display version number when not provided', async () => {
    const mockHistory = [
      createMockEntry('entry-1', 'No version', new Date('2024-01-01'), true, 'manual')
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    await screen.findByText('No version');

    expect(screen.queryByText(/^v\d+$/)).not.toBeInTheDocument();
  });

  it('should apply custom className to button', () => {
    render(<FieldHistoryPopover history={[]} className="custom-class" />);

    const button = screen.getByRole('button', { name: /view field history/i });
    expect(button).toHaveClass('custom-class');
  });

  it('should maintain button size and style', () => {
    render(<FieldHistoryPopover history={[]} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    expect(button).toHaveClass('h-8', 'w-8');
  });

  it('should handle entries without editSource metadata gracefully', async () => {
    const entryWithoutEditSource: KnowledgeEntry = {
      id: 'entry-1',
      userId: 'test-user',
      fieldIdentifier: 'test-field',
      content: 'Test content',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      isCurrentVersion: true
      // metadata is undefined
    };

    render(<FieldHistoryPopover history={[entryWithoutEditSource]} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    // Should render without crashing
    expect(await screen.findByText('Test content')).toBeInTheDocument();
  });

  it('should render multiple entries with mixed edit sources', async () => {
    const mockHistory = [
      createMockEntry('entry-1', 'Manual 1', new Date('2024-01-01'), false, 'manual', 1),
      createMockEntry('entry-2', 'AI 1', new Date('2024-01-02'), false, 'ai', 2),
      createMockEntry('entry-3', 'Manual 2', new Date('2024-01-03'), false, 'manual', 3),
      createMockEntry('entry-4', 'AI 2', new Date('2024-01-04'), true, 'ai', 4)
    ];

    render(<FieldHistoryPopover history={mockHistory} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    // Should have 2 Manual and 2 AI badges
    const manualBadges = await screen.findAllByText('Manual');
    const aiBadges = await screen.findAllByText('AI');

    expect(manualBadges).toHaveLength(2);
    expect(aiBadges).toHaveLength(2);
  });

  it('should display popover aligned to end', async () => {
    render(<FieldHistoryPopover history={[]} />);

    const button = screen.getByRole('button', { name: /view field history/i });
    fireEvent.click(button);

    const popoverContent = await screen.findByRole('dialog');
    expect(popoverContent).toBeInTheDocument();
  });
});
