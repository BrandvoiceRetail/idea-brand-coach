import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GhostTextFieldWrapper } from '../GhostTextFieldWrapper';

describe('GhostTextFieldWrapper', () => {
  const mockOnAccept = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render children (the wrapped input)', () => {
      render(
        <GhostTextFieldWrapper
          pendingValue="ghost value"
          onAccept={mockOnAccept}
        >
          <input data-testid="child-input" placeholder="Type here" />
        </GhostTextFieldWrapper>
      );

      expect(screen.getByTestId('child-input')).toBeInTheDocument();
    });

    it('should render ghost text overlay when pendingValue is provided', () => {
      render(
        <GhostTextFieldWrapper
          pendingValue="Suggested brand name"
          onAccept={mockOnAccept}
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      const overlay = screen.getByTestId('ghost-text-overlay');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveTextContent('Suggested brand name');
    });

    it('should render Tab-to-accept hint', () => {
      render(
        <GhostTextFieldWrapper
          pendingValue="Some value"
          onAccept={mockOnAccept}
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      const hint = screen.getByTestId('ghost-text-hint');
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent('Tab');
      expect(hint).toHaveTextContent('accept');
    });

    it('should not render ghost overlay when pendingValue is empty', () => {
      render(
        <GhostTextFieldWrapper
          pendingValue=""
          onAccept={mockOnAccept}
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      expect(screen.queryByTestId('ghost-text-overlay')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ghost-text-hint')).not.toBeInTheDocument();
    });

    it('should mark ghost overlay as aria-hidden', () => {
      render(
        <GhostTextFieldWrapper
          pendingValue="ghost value"
          onAccept={mockOnAccept}
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      const overlay = screen.getByTestId('ghost-text-overlay');
      expect(overlay.parentElement).toHaveAttribute('aria-hidden', 'true');
    });

    it('should mark ghost overlay as pointer-events-none', () => {
      render(
        <GhostTextFieldWrapper
          pendingValue="ghost value"
          onAccept={mockOnAccept}
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      const overlay = screen.getByTestId('ghost-text-overlay');
      expect(overlay.parentElement).toHaveClass('pointer-events-none');
    });

    it('should apply custom className to wrapper', () => {
      const { container } = render(
        <GhostTextFieldWrapper
          pendingValue="ghost value"
          onAccept={mockOnAccept}
          className="custom-wrapper-class"
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-wrapper-class');
      expect(wrapper).toHaveClass('relative');
    });
  });

  describe('Tab key acceptance', () => {
    it('should call onAccept with pendingValue when Tab is pressed', () => {
      render(
        <GhostTextFieldWrapper
          pendingValue="Accepted value"
          onAccept={mockOnAccept}
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      const input = screen.getByTestId('child-input');
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(mockOnAccept).toHaveBeenCalledOnce();
      expect(mockOnAccept).toHaveBeenCalledWith('Accepted value');
    });

    it('should not call onAccept when other keys are pressed', () => {
      render(
        <GhostTextFieldWrapper
          pendingValue="ghost value"
          onAccept={mockOnAccept}
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      const input = screen.getByTestId('child-input');
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyDown(input, { key: 'a' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      expect(mockOnAccept).not.toHaveBeenCalled();
    });
  });

  describe('Escape key dismissal', () => {
    it('should dismiss ghost text when Escape is pressed', () => {
      render(
        <GhostTextFieldWrapper
          pendingValue="ghost value"
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      expect(screen.getByTestId('ghost-text-overlay')).toBeInTheDocument();

      const input = screen.getByTestId('child-input');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(screen.queryByTestId('ghost-text-overlay')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ghost-text-hint')).not.toBeInTheDocument();
    });

    it('should call onDismiss callback when Escape is pressed', () => {
      render(
        <GhostTextFieldWrapper
          pendingValue="ghost value"
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      const input = screen.getByTestId('child-input');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockOnDismiss).toHaveBeenCalledOnce();
    });

    it('should not call onAccept after ghost text is dismissed', () => {
      render(
        <GhostTextFieldWrapper
          pendingValue="ghost value"
          onAccept={mockOnAccept}
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      const input = screen.getByTestId('child-input');
      // Dismiss first
      fireEvent.keyDown(input, { key: 'Escape' });
      // Then try Tab
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(mockOnAccept).not.toHaveBeenCalled();
    });
  });

  describe('pendingValue changes', () => {
    it('should reset dismissed state when pendingValue changes', () => {
      const { rerender } = render(
        <GhostTextFieldWrapper
          pendingValue="first value"
          onAccept={mockOnAccept}
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      // Dismiss the ghost text
      const input = screen.getByTestId('child-input');
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByTestId('ghost-text-overlay')).not.toBeInTheDocument();

      // Change the pending value
      rerender(
        <GhostTextFieldWrapper
          pendingValue="second value"
          onAccept={mockOnAccept}
        >
          <input data-testid="child-input" />
        </GhostTextFieldWrapper>
      );

      // Ghost text should reappear with new value
      const overlay = screen.getByTestId('ghost-text-overlay');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveTextContent('second value');
    });
  });
});
