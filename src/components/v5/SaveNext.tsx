/**
 * SaveNext — /v5 step ⑥: the earn-the-ask save moment + the come-back loop.
 *
 * Anonymous users convert to a permanent account via
 * `supabase.auth.updateUser({ email })` (handled by the parent); already-
 * permanent users just see that their work is saved. Their OTHER imported
 * listings render as next-listing cards ("Read in express" = same compute,
 * instant reveals). The what's-next section is ONE dimmed coming-soon card,
 * tied to their result. Nothing else.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassEyebrow, GlassPanel } from '@/components/v2/problem-solver/glass';
import type { ImportedProduct } from '@/services/interfaces/IProductDataService';
import { V5Stage } from './V5Chrome';

export interface SaveNextProps {
  /** True when the session is anonymous (show the email save ask). */
  isAnonymous: boolean;
  /** True after the confirmation email went out. */
  saved: boolean;
  saveError: string | null;
  isSaving: boolean;
  onSaveEmail: (email: string) => void;
  /** The seller's other imported listings (current one excluded). */
  otherProducts: ImportedProduct[];
  onExpressRun: (asin: string, title: string | null) => void;
  onStartOver: () => void;
}

export function SaveNext({
  isAnonymous,
  saved,
  saveError,
  isSaving,
  onSaveEmail,
  otherProducts,
  onExpressRun,
  onStartOver,
}: SaveNextProps): JSX.Element {
  const [email, setEmail] = useState('');
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Honest stakes: "saved" may only be claimed once it is durable. An anonymous
  // session lives and dies with this browser, so say exactly that until the
  // email converts it into a real account.
  const atRisk = isAnonymous && !saved;

  return (
    <V5Stage wide>
      <div className="mb-7 text-center">
        <GlassEyebrow>Your brief is ready</GlassEyebrow>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          {atRisk ? 'Right now it only lives in this browser.' : 'Saved. It’s yours to keep.'}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          {atRisk
            ? 'Clear your cookies or switch devices and it is gone. Your email below keeps it safe.'
            : 'One fix, one score, one brief, waiting for you whenever you need it.'}
        </p>
      </div>

      {/* ── The save ask (earned, not gated) ── */}
      <GlassPanel strong className="mb-4 p-6">
        <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
          Keep your brief
        </div>
        {atRisk ? (
          <>
            <div className="mb-3.5 text-[15px] font-extrabold text-foreground">
              Give me your email and I will keep your profile, score and brief safe. That is your
              free account, no password.
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                type="email"
                className="flex-1 rounded-xl border border-border bg-foreground/[0.04] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-gold-warm/50"
                placeholder="you@yourbrand.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && emailLooksValid) onSaveEmail(email.trim());
                }}
                aria-label="Your email address"
                disabled={isSaving}
              />
              <Button
                type="button"
                variant="brand"
                className="min-h-11 rounded-xl font-extrabold"
                disabled={!emailLooksValid || isSaving}
                onClick={() => onSaveEmail(email.trim())}
              >
                {isSaving ? 'Saving…' : 'Save my work →'}
              </Button>
            </div>
            {saveError && <p className="mt-2 text-sm text-destructive">{saveError}</p>}
            <p className="mt-2.5 text-xs text-muted-foreground">
              Save it and build your next one, free. Your next visit picks up where you left off.
            </p>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-foreground/85">
            {saved
              ? 'Check your inbox to confirm. Your work is saved to your account.'
              : 'Your work is saved to your account. Come back any time; nothing to redo.'}
          </p>
        )}
      </GlassPanel>

      {/* ── Next listing (the personalised habit loop) ── */}
      {otherProducts.length > 0 && (
        <GlassPanel className="mb-4 p-6">
          <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
            Your other listings are probably leaking too
          </div>
          <div className="space-y-2">
            {otherProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-3"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                  {product.title || product.asin}
                </span>
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  className="shrink-0 rounded-lg font-bold"
                  onClick={() => onExpressRun(product.asin, product.title || null)}
                >
                  Read in express →
                </Button>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* ── What's next: ONE dimmed card, tied to their result ── */}
      <GlassPanel sheen={false} className="mb-4 p-6 opacity-50 grayscale-[0.3]">
        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
          Your conversion funnel
          <span className="rounded-full bg-gold-warm px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-background">
            Coming in Gen 2
          </span>
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Your Trust Gap™ will keep moving as the market moves. Soon I&apos;ll watch it for you.
        </p>
      </GlassPanel>

      <div className="text-center">
        <Button type="button" variant="ghost" className="rounded-xl text-muted-foreground" onClick={onStartOver}>
          ↺ Read another listing
        </Button>
      </div>
    </V5Stage>
  );
}
