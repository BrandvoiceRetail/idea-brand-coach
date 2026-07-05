/**
 * V5Chrome — the nav-less /v5 shell pieces: the fixed brand bar and the
 * centred glass stage column. The route is deliberately outside the /v4 app
 * chrome; this is the whole frame. The wrapper pins the DARK register (the
 * mockup's dark liquid glass) regardless of the app-wide theme toggle by
 * scoping the `.dark` token block to this subtree.
 */
import { cn } from '@/lib/utils';

/** Fixed slim brand bar (logo mark + name) — the only chrome on /v5. */
export function V5TopBar(): JSX.Element {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[58px] items-center border-b border-border bg-background/70 px-6 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-gold-warm text-xs font-extrabold text-background">
          IB
        </div>
        <span className="text-sm font-semibold text-foreground">
          IDEA <span className="text-gold-warm">Brand Coach</span>
        </span>
      </div>
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
