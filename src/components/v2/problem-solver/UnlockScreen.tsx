/**
 * S2 — Unlock (founding-member framing).
 *
 * The demo's paygate. In Alpha, billing is STUBBED — no real payment. The CTA is
 * an auth gate: signed-in users continue to S3 (Upload); signed-out users are
 * routed to /auth?redirect=/v2/diagnostic to create a free account / sign in.
 * The £97 founding-member price is shown as framing only (matches the demo).
 */

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PS_COLORS } from './theme';
import { Eyebrow, ScreenHeading, Lede, PSCard, GhostButton } from './primitives';

interface UnlockScreenProps {
  isAuthenticated: boolean;
  /** Continue to S3 (signed-in) — the shell decides; here we just call onUnlock. */
  onUnlock: () => void;
  onBack: () => void;
}

const LOOP = ['Diagnose', 'Analyse', 'Fix', 'Re-measure', 'Defend'];

const BENEFITS = [
  'Your customer profile, built from your actual reviews',
  'Your primary conversion problem — in plain language',
  'Your Decision Trigger™ — the one lever to pull first',
  'A design brief ready to hand to your designer or VA',
  'All future Beta features as they ship, at no extra cost',
];

export function UnlockScreen({ isAuthenticated, onUnlock, onBack }: UnlockScreenProps): JSX.Element {
  return (
    <div>
      <Eyebrow>Next step</Eyebrow>
      <ScreenHeading accent="what to fix.">Find out exactly</ScreenHeading>
      <Lede>
        The free score shows <b>where</b> the problem is. The full analysis tells you <b>what</b> it is —
        reads your listing against your own customers&rsquo; reviews, and hands you a brief to act on today.
      </Lede>

      <PSCard>
        <div
          className="mb-3 text-[11px] font-extrabold uppercase tracking-wide"
          style={{ color: PS_COLORS.g500 }}
        >
          Your Trust Gap Score is the start of the loop, not the end of it
        </div>
        <div className="mb-2.5 flex flex-wrap justify-center gap-1.5 text-[12.5px] font-bold">
          {LOOP.map((step, i) => (
            <span key={step} className="flex items-center gap-1.5">
              <span
                className="rounded-full border px-3 py-1.5"
                style={{
                  background: PS_COLORS.g100,
                  borderColor: PS_COLORS.line,
                  color: i === 0 ? PS_COLORS.navy : PS_COLORS.g500,
                }}
              >
                {step}
              </span>
              {i < LOOP.length - 1 && <span style={{ color: PS_COLORS.gold }}>→</span>}
            </span>
          ))}
        </div>
        <p className="m-0 text-center text-[12.5px]" style={{ color: PS_COLORS.g500 }}>
          The app re-measures automatically. When competitors move, you know first.
        </p>
      </PSCard>

      <div
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: PS_COLORS.navy }}
      >
        <div
          className="mb-4 inline-block rounded-md border px-3 py-2 text-xs font-bold"
          style={{
            background: 'rgba(201,168,76,.16)',
            borderColor: 'rgba(201,168,76,.4)',
            color: PS_COLORS.gold,
          }}
        >
          ★ Founding member offer — limited availability
        </div>
        <h2 className="mb-2.5 text-xl font-extrabold">Upload your listing. Get your fix brief in 15 minutes.</h2>
        <ul className="mb-4 space-y-1.5">
          {BENEFITS.map((b) => (
            <li key={b} className="flex gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,.86)' }}>
              <span className="font-black" style={{ color: PS_COLORS.gold }}>
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>
        <div className="mb-3.5 flex items-baseline gap-2">
          <span className="text-lg font-bold line-through" style={{ color: 'rgba(255,255,255,.5)' }}>
            £297
          </span>
          <span className="text-[34px] font-extrabold">£97</span>
          <span className="text-[13px]" style={{ color: 'rgba(255,255,255,.6)' }}>
            founding member · save £200
          </span>
        </div>
        <button
          type="button"
          onClick={onUnlock}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] px-5 py-3 text-sm font-extrabold"
          style={{ background: PS_COLORS.gold, color: PS_COLORS.navy }}
        >
          {isAuthenticated ? 'Claim my founding price' : 'Create a free account to continue'}
          <ArrowRight className="h-4 w-4" />
        </button>
        <div
          className="mt-3 border-t pt-3 text-xs"
          style={{ borderColor: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.6)' }}
        >
          {isAuthenticated
            ? '★ Founding members lock the lowest price we will ever offer. This offer is for a limited time only.'
            : "★ Alpha: no payment is taken — you'll create a free account and go straight to your analysis."}
        </div>
      </div>

      <div className="mt-4 flex justify-between">
        <GhostButton onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to score
        </GhostButton>
        <span />
      </div>
    </div>
  );
}
