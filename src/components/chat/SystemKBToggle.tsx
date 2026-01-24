/**
 * SystemKBToggle
 * Reusable toggle button for enabling/disabling IDEA Framework System KB integration.
 *
 * When enabled, chat messages use the test function that includes
 * Trevor's IDEA Framework book in the context via file_search.
 */

import { Button } from '@/components/ui/button';
import { Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemKBToggleProps {
  /** Whether System KB is currently enabled */
  enabled: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
  /** Display variant */
  variant?: 'default' | 'compact';
  /** Additional class names */
  className?: string;
}

export function SystemKBToggle({
  enabled,
  onToggle,
  variant = 'default',
  className,
}: SystemKBToggleProps): JSX.Element {
  if (variant === 'compact') {
    return (
      <Button
        variant={enabled ? 'default' : 'ghost'}
        size="sm"
        onClick={onToggle}
        className={cn('h-7 px-2 text-xs', className)}
        title={enabled ? 'IDEA KB Enabled - Click to disable' : 'Enable IDEA KB'}
      >
        <Brain className="w-3 h-3" />
        {enabled && <span className="ml-1">KB</span>}
      </Button>
    );
  }

  return (
    <Button
      variant={enabled ? 'default' : 'outline'}
      size="sm"
      onClick={onToggle}
      className={cn('text-xs', className)}
      title={enabled ? 'Click to disable IDEA Framework Knowledge Base' : 'Click to enable IDEA Framework Knowledge Base'}
    >
      <Brain className="w-3 h-3 mr-1" />
      {enabled ? 'IDEA KB: ON' : 'IDEA KB: OFF'}
    </Button>
  );
}
