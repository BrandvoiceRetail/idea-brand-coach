/**
 * S6 — Membership ("earn the ask").
 *
 * Repositioned AFTER the fix (was the pre-value S2 paygate). The customer has
 * already received the free diagnostic, customer profile, Decision Trigger, and a
 * fix brief — so this is no longer a wall, it's the upgrade: the free trial lets
 * them iterate on ONE funnel piece; membership puts their WHOLE funnel on the loop
 * with ongoing monitoring. Billing is STUBBED in Alpha — `onUnlock` just continues
 * to the Brand Defence showcase; the £97 price is framing only.
 */

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PS_COLORS } from './theme';
import { Eyebrow, ScreenHeading, Lede, PSCard, GhostButton } from './primitives';

interface UnlockScreenProps {
  isAuthenticated: boolean;
  /** Continue to the Brand Defence showcase — the shell decides; we just call onUnlock. */
  onUnlock: () => void;
  onBack: () => void;
}

const LOOP = ['Diagnose', 'Analyse', 'Fix', 'Re-measure', 'Defend'];

const BENEFITS = [
  'Your whole funnel monitored — every piece, every stage',
  'Automatic re-measurement as your numbers move',
  'Brand Defence — know the moment a competitor closes the gap',
  'Every fix brief, ready to hand to your designer or VA',
  'All future features as they ship, at no extra cost',
];

export function UnlockScreen({ isAuthenticated, onUnlock, onBack }: UnlockScreenProps): JSX.Element {
  return (
    <div>
      <Eyebrow>Keep going</Eyebrow>
      <ScreenHeading accent="ahead of the gap.">Keep your whole funnel</ScreenHeading>
      <Lede>
        You&rsquo;ve found your gap and your first fix &mdash; <b>free</b>. Your free trial lets you keep
        iterating on <b>one funnel piece</b>. Become a member to put your <b>whole funnel</b> on the loop and
        monitor it as the gap moves.
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
        <h2 className="mb-2.5 text-xl font-extrabold">Free trial: one funnel piece to iterate on.</h2>
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
          {isAuthenticated ? 'Start my free trial' : 'Create a free account to start'}
          <ArrowRight className="h-4 w-4" />
        </button>
        <div
          className="mt-3 border-t pt-3 text-xs"
          style={{ borderColor: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.6)' }}
        >
          {isAuthenticated
            ? '★ Founding members lock the lowest price we will ever offer. Alpha: no payment is taken — your free trial starts now.'
            : "★ Alpha: no payment is taken — create a free account and your trial starts now."}
        </div>
      </div>

      <div className="mt-4 flex justify-between">
        <GhostButton onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to my fix
        </GhostButton>
        <span />
      </div>
    </div>
  );
}
