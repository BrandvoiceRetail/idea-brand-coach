/**
 * V5Chrome — the nav-less /v5 shell pieces: the fixed brand bar and the
 * centred glass stage column. The route is deliberately outside the /v4 app
 * chrome; this is the whole frame. The wrapper pins the DARK register (the
 * mockup's dark liquid glass) regardless of the app-wide theme toggle by
 * scoping the `.dark` token block to this subtree.
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

/**
 * Fixed slim brand bar (logo mark + name) — the only chrome on /v5, plus the
 * one auth control: signed-in accounts get their email + log out; anonymous
 * and signed-out visitors get a sign in / sign up link that returns to /v5.
 */
export function V5TopBar(): JSX.Element {
  const { user, signOut } = useAuth();
  const isRealAccount = !!user && user.is_anonymous !== true;

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[58px] items-center border-b border-border bg-background/70 px-6 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <img
          src="/lovable-uploads/717bf765-c54a-4447-9685-6c5a3ee84297.png"
          alt="IDEA Brand Coach"
          className="h-7 w-auto"
        />
        <span className="text-sm font-semibold text-foreground">
          IDEA <span className="text-gold-warm">Brand Coach</span>
        </span>
      </div>
      {isRealAccount ? (
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground sm:block">
            {user.email}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground"
            onClick={() => {
              // Full reload back to the entry screen so no run state survives
              // the account switch.
              void signOut().then(() => window.location.assign('/v5'));
            }}
          >
            Log out
          </Button>
        </div>
      ) : (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="ml-auto rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <Link to="/auth?redirect=/v5">Sign in / Sign up</Link>
        </Button>
      )}
    </header>
  );
}

/** One centred stage (one screen, one job) over the ambient gold-lit backdrop. */
export function V5Stage({
  wide = false,
  className,
  children,
}: {
  /** 720px column for the theatre/results; 560px for entry-weight screens. */
  wide?: boolean;
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="glass-stage flex min-h-screen w-full flex-col items-center px-5 pb-24 pt-[92px]">
      <div
        className={cn(
          'animate-view-in mx-auto w-full',
          wide ? 'max-w-[720px]' : 'max-w-[560px]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
