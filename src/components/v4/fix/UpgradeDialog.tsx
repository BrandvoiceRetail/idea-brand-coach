/**
 * UpgradeDialog (Loop-3) — the free-trial → membership ask, shown when a non-member
 * hits the one-piece trial limit and tries to add another funnel piece.
 *
 * MODEL (Matthew, 2026-06-29): the free trial covers ONE funnel piece to iterate on;
 * membership unlocks the whole funnel + ongoing monitoring. This is the gate that
 * makes "earn the ask" real: the owner has already worked their one piece, so the
 * ask lands on value, not before it. Billing is Phase-2/stubbed, so the CTA routes
 * to the pricing page rather than a live checkout.
 */
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FREE_TRIAL_PIECE_LIMIT } from '@/lib/entitlement';
import { captureAlphaEvent } from '@/lib/posthogClient';

export interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MEMBER_BENEFITS = [
  'Map your whole funnel — every piece, every stage',
  'Ongoing monitoring — re-measure as your numbers move',
  'Brand Defence — know when a competitor closes the gap',
] as const;

export function UpgradeDialog({ open, onOpenChange }: UpgradeDialogProps): JSX.Element {
  const navigate = useNavigate();

  const handleUpgrade = (): void => {
    captureAlphaEvent('v4_upgrade_cta_clicked', { from: 'trial_limit' });
    onOpenChange(false);
    navigate('/v1/subscribe');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You&apos;ve used your free trial piece</DialogTitle>
          <DialogDescription>
            Your free trial covers {FREE_TRIAL_PIECE_LIMIT} funnel piece to iterate on — diagnose it, fix it,
            and re-test it as much as you like. Become a member to map and monitor your whole funnel.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 py-2">
          {MEMBER_BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-warm" />
              {b}
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Keep iterating on my piece
          </Button>
          <Button type="button" variant="brand" className="gap-2" onClick={handleUpgrade}>
            Become a member
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
