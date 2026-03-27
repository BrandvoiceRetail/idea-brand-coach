/**
 * AcceptAllToggle Component
 *
 * A simple Switch + label for toggling the "auto-accept future extractions"
 * preference. Designed for placement in the BatchReviewOrchestrator header.
 */

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// ============================================================================
// Types
// ============================================================================

export interface AcceptAllToggleProps {
  /** Whether auto-accept is currently enabled */
  isOn: boolean;
  /** Callback when the toggle is changed */
  onToggle: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function AcceptAllToggle({ isOn, onToggle }: AcceptAllToggleProps): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="accept-all-toggle"
        checked={isOn}
        onCheckedChange={onToggle}
        aria-label="Auto-accept future extractions"
      />
      <Label
        htmlFor="accept-all-toggle"
        className="text-sm text-muted-foreground cursor-pointer select-none"
      >
        Auto-accept future extractions
      </Label>
    </div>
  );
}
