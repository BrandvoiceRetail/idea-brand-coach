/**
 * S6 — Your fix (Decision Trigger + design-brief framing).
 *
 * Renders the engine's primary-conversion-problem summary (from interpretation),
 * the Decision Trigger via the shared DecisionTriggerPanel (its additive `result`
 * prop — so it renders the already-derived trigger without re-calling the engine),
 * and an HONEST design-brief framing. The full generate_brief is FUTURE: we render
 * the trigger's own placement_instruction as the actionable "where to use it"
 * guidance rather than fabricating a full brief.
 *
 * LIVE-WIRED: the trigger + interpretation are real engine output. When the trigger
 * is absent (thin corpus → engine returned null), the panel degrades to its locked
 * teaser rather than showing fake content.
 */

import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { DecisionTriggerPanel } from '@/components/decision-trigger/DecisionTriggerPanel';
import type { TrustGapInputScores } from '@/lib/trustGap';
import { PS_COLORS } from './theme';
import { Eyebrow, ScreenHeading, GhostButton, GoldButton } from './primitives';
import { forensicToInputScores, mapDecisionTrigger } from './forensicMapping';
import type { ForensicResponse } from './types';

interface FixScreenProps {
  report: ForensicResponse;
  onBack: () => void;
  onContinue: () => void;
}

export function FixScreen({ report, onBack, onContinue }: FixScreenProps): JSX.Element {
  const trigger = mapDecisionTrigger(report.decision_trigger);
  const scores: TrustGapInputScores = forensicToInputScores(report.forensic_scores);
  const primaryProblem = report.interpretation?.primaryGapSummary;

  return (
    <div>
      <Eyebrow>Your primary conversion problem &amp; the fix</Eyebrow>
      <ScreenHeading accent="One lever.">One problem.</ScreenHeading>

      {primaryProblem && (
        <div
          className="mb-4 rounded-2xl border p-4"
          style={{ background: PS_COLORS.goldLight, borderColor: '#efe0bf' }}
        >
          <div
            className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide"
            style={{ color: PS_COLORS.warn }}
          >
            Your primary conversion problem
          </div>
          <p className="text-[15px] leading-relaxed" style={{ color: PS_COLORS.navy }}>
            {primaryProblem}
          </p>
        </div>
      )}

      {/* The Decision Trigger — rendered directly from the forensic response. */}
      <div className="mb-4">
        <DecisionTriggerPanel
          scores={scores}
          evidence={undefined}
          evidenceKey={undefined}
          sessionId={report.asin}
          isAuthenticated
          result={trigger}
        />
      </div>

      {/* Design-brief framing — honest: the full generate_brief is FUTURE. We render
          the trigger's own placement instruction as the actionable guidance. */}
      {trigger && (
        <div className="mb-4 overflow-hidden rounded-[10px] border" style={{ borderColor: PS_COLORS.line }}>
          <div
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-extrabold"
            style={{ background: PS_COLORS.g100, color: PS_COLORS.navy }}
          >
            <MapPin className="h-4 w-4" />
            Where to use it — your starting brief
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-extrabold text-white"
              style={{ background: PS_COLORS.green }}
            >
              INCLUDED
            </span>
          </div>
          <p className="px-4 py-3 text-[13.5px] leading-relaxed" style={{ color: PS_COLORS.g900 }}>
            {trigger.placementInstruction}
          </p>
          <div className="border-t px-4 py-2.5 text-[11px]" style={{ borderColor: PS_COLORS.line, color: PS_COLORS.g500 }}>
            A full hero-image + bullet-rewrite brief is generated in the coach — start there with this
            placement guidance.
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <GhostButton onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Customer profile
        </GhostButton>
        <GoldButton onClick={onContinue}>
          What keeps it working
          <ArrowRight className="h-4 w-4" />
        </GoldButton>
      </div>
    </div>
  );
}
