/**
 * ProfileMenu — the account/session control for the single-surface shell
 * (UX spec: _bmad-output/planning-artifacts/ux-design-account-navigation.md).
 *
 * The ambient "manage my session from anywhere" anchor: a profile button
 * (account owner's initials) → a menu with "Signed in as {email}", Settings,
 * and Sign out. NOTE: this is the ACCOUNT OWNER control — the word "Avatar" is
 * reserved for the customer Avatar (Avatar 2.0); a customer Avatar switcher is a
 * separate, future control and is intentionally NOT part of this menu.
 *
 * One component, two anchors via `variant`: `full` (desktop sidebar rail) and
 * `compact` (mobile top bar). Reuses the existing auth seam (`useAuth().signOut`)
 * and shadcn `DropdownMenu` (which provides the keyboard + focus a11y).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, ChevronsUpDown, Loader2, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

/** Derive 1–2 uppercase initials from the account owner's email (never invented). */
export function initialsFromEmail(email: string | null | undefined): string {
  if (!email) return '?';
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[.\-_+]+/).filter(Boolean);
  const letters =
    parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : local.slice(0, 2);
  return (letters || '?').toUpperCase();
}

export interface ProfileMenuProps {
  /** `full` = desktop rail (initials + email + chevron); `compact` = mobile (initials only). */
  variant?: 'full' | 'compact';
  /** Which side the menu opens (desktop rail opens up; mobile top bar opens down). */
  side?: 'top' | 'bottom';
}

export function ProfileMenu({ variant = 'full', side = 'top' }: ProfileMenuProps): JSX.Element {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const email = user?.email ?? null;
  const initials = initialsFromEmail(email);

  const handleSignOut = async (): Promise<void> => {
    setSigningOut(true);
    try {
      await signOut();
      toast.success('Signed out');
      navigate('/auth');
    } catch {
      toast.error("Couldn't sign out — try again");
      setSigningOut(false); // keep the menu usable; user can retry
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={email ? `Account menu for ${email}` : 'Account menu'}
        data-testid="profile-menu-trigger"
        className={cn(
          'flex items-center gap-2 rounded-md outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-gold-warm',
          variant === 'full'
            ? 'mx-3 mb-3 mt-1 min-h-[44px] w-[calc(100%-1.5rem)] px-3 py-2 text-left hover:bg-background/10'
            : 'min-h-[44px] min-w-[44px] justify-center p-1.5 hover:bg-background/10',
        )}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-gold-warm text-xs font-semibold text-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        {variant === 'full' && (
          <>
            <span className="min-w-0 flex-1 truncate text-sm text-background/80" title={email ?? undefined}>
              {email ?? 'Account'}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-background/50" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent side={side} align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-xs text-muted-foreground">Signed in as</span>
          <span className="block truncate text-sm font-medium" title={email ?? undefined}>
            {email ?? 'your account'}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="profile-menu-theme-toggle"
          onSelect={(e) => {
            // Keep the menu open so the user can see the surface change behind it.
            e.preventDefault();
            toggleTheme();
          }}
        >
          {theme === 'dark' ? (
            <Sun className="mr-2 h-4 w-4" aria-hidden />
          ) : (
            <Moon className="mr-2 h-4 w-4" aria-hidden />
          )}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(ROUTES.SETTINGS)}>
          <Settings className="mr-2 h-4 w-4" aria-hidden />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="profile-menu-signout"
          disabled={signingOut}
          onSelect={(e) => {
            // Keep the menu open through the async sign-out so the spinner shows
            // and an error can be retried without re-opening.
            e.preventDefault();
            void handleSignOut();
          }}
          className="text-destructive focus:text-destructive"
        >
          {signingOut ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <LogOut className="mr-2 h-4 w-4" aria-hidden />
          )}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
