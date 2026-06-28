/**
 * S5 — Customer profile (Avatar 2.0 Layer 1).
 *
 * Renders the forensic Trust Gap scorecard (forensic_scores → buildTrustGap /25)
 * plus the NEW customer_profile four cards (how_they_talk / why_buying_now /
 * what_builds_trust / what_stops_them), a "Grounded in N reviews" badge, and the
 * thin-corpus caveat. Data is REAL — whatever the engine returned. When a profile
 * field is empty (thin corpus), it is honestly labelled rather than faked.
 */

import { ArrowLeft, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';
import { buildTrustGap, TRUST_GAP_MAX_PER_DIMENSION } from '@/lib/trustGap';
import { PS_COLORS } from './theme';
import { Eyebrow, ScreenHeading, Lede, GhostButton, GoldButton } from './primitives';
import { forensicToInputScores } from './forensicMapping';
import type { ForensicResponse } from './types';

interface CustomerScreenProps {
  report: ForensicResponse;
  onBack: () => void;
  onContinue: () => void;
}

const PROFILE_FIELDS: ReadonlyArray<{ key: keyof NonNullable<ForensicResponse['customer_profile']>; label: string }> = [
  { key: 'how_they_talk', label: 'How your customer talks' },
  { key: 'why_buying_now', label: "Why they're buying today" },
  { key: 'what_builds_trust', label: 'What builds trust for them' },
  { key: 'what_stops_them', label: 'What stops them buying' },
];

export function CustomerScreen({ report, onBack, onContinue }: CustomerScreenProps): JSX.Element {
  const model = buildTrustGap(forensicToInputScores(report.forensic_scores));
  const byKey = Object.fromEntries(model.dimensions.map((d) => [d.key, d]));
  const profile = report.customer_profile;

  return (
    <div>
      <Eyebrow>Your customer profile</Eyebrow>
      <ScreenHeading accent="really telling you.">What your reviews are</ScreenHeading>
      <Lede>
        Not demographics. The forensic portrait of the person you&rsquo;re actually selling to — built from
        your own reviews.
      </Lede>

      {/* Forensic Trust Gap summary (real scores). */}
      <div
        className="mb-4 rounded-2xl border bg-white p-5"
        style={{ borderColor: PS_COLORS.line, boxShadow: '0 1px 3px rgba(16,24,40,.10)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-semibold" style={{ color: PS_COLORS.navy }}>
            Your forensic Trust Gap™
          </div>
          <div className="text-3xl font-extrabold tabular-nums" style={{ color: PS_COLORS.navy }}>
            {model.overall}
            <span className="text-base font-medium" style={{ color: PS_COLORS.g500 }}>
              /100
            </span>
          </div>
        </div>

        <div
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
          style={{ background: PS_COLORS.navyLight, color: PS_COLORS.navy, borderColor: PS_COLORS.line }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Grounded in your {report.reviews_analyzed} real review{report.reviews_analyzed === 1 ? '' : 's'}
        </div>

        {report.thin_corpus && (
          <div
            className="mt-3 flex items-start gap-2 rounded-lg border p-3 text-sm"
            style={{ background: PS_COLORS.warnLight, borderColor: '#f5d28a', color: PS_COLORS.warn }}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Based on {report.reviews_analyzed} review{report.reviews_analyzed === 1 ? '' : 's'} — a thin
              sample, so treat this read as directional. Importing more reviews sharpens it.
            </span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {model.dimensions.map((d) => (
            <div key={d.key} className="rounded-lg border p-3" style={{ borderColor: PS_COLORS.line }}>
              <div className="text-sm font-medium" style={{ color: PS_COLORS.navy }}>
                {d.label}
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: PS_COLORS.navy }}>
                {byKey[d.key]?.score ?? 0}
                <span className="text-sm font-medium" style={{ color: PS_COLORS.g500 }}>
                  /{TRUST_GAP_MAX_PER_DIMENSION}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The four customer-profile cards (real, engine-derived). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PROFILE_FIELDS.map((f) => {
          const value = profile?.[f.key]?.trim();
          return (
            <div key={f.key} className="rounded-[10px] border bg-white p-3.5" style={{ borderColor: PS_COLORS.line }}>
              <div
                className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide"
                style={{ color: PS_COLORS.gold }}
              >
                {f.label}
              </div>
              <div className="text-[13px] leading-relaxed" style={{ color: PS_COLORS.g900 }}>
                {value || (
                  <span className="italic" style={{ color: PS_COLORS.g500 }}>
                    Not enough review signal to read this confidently yet.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-between">
        <GhostButton onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          The analysis
        </GhostButton>
        <GoldButton onClick={onContinue}>
          See your fix
          <ArrowRight className="h-4 w-4" />
        </GoldButton>
      </div>
    </div>
  );
}
