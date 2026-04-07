/**
 * Tests for AdaptiveFieldReview component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AdaptiveFieldReview, ReviewField } from '../AdaptiveFieldReview';
import * as useDeviceTypeModule from '@/hooks/useDeviceType';

// Mock the device type hook
vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: vi.fn(() => ({
    deviceType: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false,
    width: 1920,
    height: 1080,
  })),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

describe('AdaptiveFieldReview', () => {
  const mockFields: ReviewField[] = [
    {
      id: 'brand-name',
      label: 'Brand Name',
      type: 'text',
      placeholder: 'Enter brand name',
      required: true,
      value: 'Test Brand',
      source: 'ai',
    },
    {
      id: 'mission',
      label: 'Mission Statement',
      type: 'textarea',
      placeholder: 'Enter mission',
      required: true,
      value: 'Our mission is to test',
      source: 'ai',
    },
    {
      id: 'values',
      label: 'Core Values',
      type: 'array',
      placeholder: 'Enter values',
      required: false,
      value: ['Innovation', 'Quality'],
      source: 'manual',
    },
  ];

  const mockHandlers = {
    onClose: vi.fn(),
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onEdit: vi.fn(),
    onNavigate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Desktop variant', () => {
    beforeEach(() => {
      vi.mocked(useDeviceTypeModule.useDeviceType).mockReturnValue({
        deviceType: 'desktop',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isTouchDevice: false,
        width: 1920,
        height: 1080,
      });
    });

    it('should render desktop sidebar variant', () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Review Extracted Fields')).toBeInTheDocument();
      expect(screen.getByText('Brand Name')).toBeInTheDocument();
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('should show current field value', () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      const input = screen.getByDisplayValue('Test Brand');
      expect(input).toBeInTheDocument();
    });

    it('should show AI source badge', () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('AI Extracted')).toBeInTheDocument();
    });

    it('should handle accept action', async () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      const acceptButton = screen.getByRole('button', { name: /accept/i });
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(mockHandlers.onAccept).toHaveBeenCalledWith(
          mockFields[0],
          'Test Brand'
        );
      });
    });

    it('should handle reject action', async () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      fireEvent.click(rejectButton);

      await waitFor(() => {
        expect(mockHandlers.onReject).toHaveBeenCalledWith(mockFields[0]);
      });
    });

    it('should navigate to next field after accept', async () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      const acceptButton = screen.getByRole('button', { name: /accept/i });
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(mockHandlers.onNavigate).toHaveBeenCalledWith(1);
      });
    });

    it('should show next field preview', () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Next Field')).toBeInTheDocument();
      expect(screen.getByText('Mission Statement')).toBeInTheDocument();
    });

    it('should show keyboard shortcuts help', () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          showHelp={true}
          {...mockHandlers}
        />
      );

      const shortcutsHeading = screen.getByText('Keyboard Shortcuts');
      expect(shortcutsHeading).toBeInTheDocument();
      // "Accept" and "Reject" appear in both action buttons and shortcuts help;
      // scope to the shortcuts section to avoid ambiguity.
      const shortcutsSection = shortcutsHeading.closest('div.space-y-2')!;
      expect(within(shortcutsSection as HTMLElement).getByText('Accept')).toBeInTheDocument();
      expect(within(shortcutsSection as HTMLElement).getByText('Reject')).toBeInTheDocument();
    });

    it('should handle field editing', async () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      const input = screen.getByDisplayValue('Test Brand');
      fireEvent.change(input, { target: { value: 'New Brand Name' } });

      await waitFor(() => {
        expect(mockHandlers.onEdit).toHaveBeenCalledWith(
          mockFields[0],
          'New Brand Name'
        );
      });
    });

    it('should disable previous button on first field', () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button on last field', () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={2}
          {...mockHandlers}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Mobile variant', () => {
    beforeEach(() => {
      vi.mocked(useDeviceTypeModule.useDeviceType).mockReturnValue({
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isTouchDevice: true,
        width: 375,
        height: 812,
      });
    });

    it('should render mobile bottom sheet variant', () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Review Extracted Fields')).toBeInTheDocument();
      expect(screen.getByText('Swipe or tap to accept or reject extracted values')).toBeInTheDocument();
    });

    it('should show swipe hints', () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Swipe to review')).toBeInTheDocument();
      // "Accept" and "Reject" appear in both swipe hints and action buttons;
      // verify at least two instances exist (hint text + button label).
      expect(screen.getAllByText('Accept').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Reject').length).toBeGreaterThanOrEqual(2);
    });

    it('should show progress dots', () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={1}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('2 of 3')).toBeInTheDocument();
    });

    it('should show next field preview on mobile', () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Up next:')).toBeInTheDocument();
      expect(screen.getByText('Mission Statement')).toBeInTheDocument();
    });

    it('should handle tap actions on mobile', async () => {
      render(
        <AdaptiveFieldReview
          fields={mockFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      const acceptButton = screen.getByRole('button', { name: /accept/i });
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(mockHandlers.onAccept).toHaveBeenCalled();
      });
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      vi.mocked(useDeviceTypeModule.useDeviceType).mockReturnValue({
        deviceType: 'desktop',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isTouchDevice: false,
        width: 1920,
        height: 1080,
      });
    });

    it('should handle empty fields array', () => {
      render(
        <AdaptiveFieldReview
          fields={[]}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      // Should not render anything
      expect(screen.queryByText('Review Extracted Fields')).not.toBeInTheDocument();
    });

    it('should handle single field', () => {
      render(
        <AdaptiveFieldReview
          fields={[mockFields[0]]}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('1 / 1')).toBeInTheDocument();
      // Should not show next field preview
      expect(screen.queryByText('Next Field')).not.toBeInTheDocument();
    });

    it('should reset textarea value when navigating between fields', async () => {
      // Use only text/textarea fields to avoid array rendering complexity
      const textFields: ReviewField[] = [
        { ...mockFields[0] },  // "Test Brand"
        { ...mockFields[1] },  // "Our mission is to test"
      ];

      const { rerender } = render(
        <AdaptiveFieldReview
          fields={textFields}
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      // Card 1: should show "Test Brand"
      expect(screen.getByDisplayValue('Test Brand')).toBeInTheDocument();

      // Navigate to card 2 by re-rendering with new index
      rerender(
        <AdaptiveFieldReview
          fields={textFields}
          isOpen={true}
          currentIndex={1}
          {...mockHandlers}
        />
      );

      // Card 2: should show mission value, NOT "Test Brand"
      await waitFor(() => {
        expect(screen.getByDisplayValue('Our mission is to test')).toBeInTheDocument();
      });
      expect(screen.queryByDisplayValue('Test Brand')).not.toBeInTheDocument();
    });

    it('should close after reviewing all fields', async () => {
      render(
        <AdaptiveFieldReview
          fields={[mockFields[2]]} // Last field only
          isOpen={true}
          currentIndex={0}
          {...mockHandlers}
        />
      );

      const acceptButton = screen.getByRole('button', { name: /accept/i });
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(mockHandlers.onClose).toHaveBeenCalled();
      });
    });
  });
});