/**
 * V4TopBar — mobile-only top bar for the single-surface shell. The desktop
 * sidebar carries the brand mark + ProfileMenu; on mobile the bottom-nav is
 * reserved for the 5 spine steps, so this slim sticky bar gives the brand mark
 * and the account ProfileMenu a home. Hidden at >=md (sidebar takes over).
 */
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { ProfileMenu } from './ProfileMenu';

export function V4TopBar(): JSX.Element {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-background/10 bg-foreground px-4 text-background md:hidden">
      <Link to="/" className="flex items-center gap-2" aria-label="Brand Coach home">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gold-warm text-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-bold tracking-tight">Brand Coach</span>
      </Link>
      <ProfileMenu variant="compact" side="bottom" />
    </header>
  );
}
