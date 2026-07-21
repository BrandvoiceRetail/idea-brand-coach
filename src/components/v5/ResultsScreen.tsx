/**
 * ResultsScreen — /v5 step ④: the finding FIRST (Component 0), the Trust Gap™
 * score + four pillar bars BENEATH it (never score-first), then the Decision
 * Trigger™ card and the four-card customer profile grid. Every value comes
 * from the run-forensic-analysis response; degraded sections render honest
 * notes, never invented copy. Brand anchors are stripped before this renders.
 */
import { Button } from '@/components/ui/button';
import {
  Component0Hero,
  GlassEyebrow,
  GlassPanel,
  ScorePillars,
  type PillarRow,
} from '@/components/v2/problem-solver/glass';
import { V5Stage } from './V5Chrome';
import { LowEvidenceBadge } from './LowEvidenceBadge';
import {
  findingText,
  normalizeProfile,
  type PillarKey,
  type V5DecisionTrigger,
  type V5ForensicReport,
} from './forensicReport';

/** I-D-E-A order, always. */
const PILLAR_ORDER: ReadonlyArray<{ key: PillarKey; name: string }> = [
  { key: 'insight', name: 'Insight' },
  { key: 'distinctive', name: 'Distinctive' },
  { key: 'empathetic', name: 'Empathetic' },
  { key: 'authentic', name: 'Authentic' },
];

/** Each pillar is scored 0-25 by the engine. */
const PILLAR_MAX = 25;

export interface ResultsScreenProps {
  report: V5ForensicReport;
  trigger: V5DecisionTrigger | undefined;
  onSeeBrief: () => void;
}

function ProfileCard({ label, heading, body }: { label: string; heading: string; body: string }): JSX.Element {
  return (
    <GlassPanel className="p-5">
      <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
        {label}
      </div>
      <div className="mb-2 text-[15px] font-extrabold text-foreground">{heading}</div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {body || 'Not enough signal in your reviews to fill this yet.'}
      </p>
    </GlassPanel>
  );
}

export function ResultsScreen({ report, trigger, onSeeBrief }: ResultsScreenProps): JSX.Element {
  const finding = findingText(report);
  const pillars: PillarRow[] = PILLAR_ORDER.map(({ key, name }) => {
    const score = report.forensic_scores[key];
    return {
      name,
      value: (score / PILLAR_MAX) * 100,
      display: `${Math.round(score)}/${PILLAR_MAX}`,
      weak: key === report.primary_gap,
    };
  });
  const profile = normalizeProfile(report.customer_profile);

  return (
    <V5Stage wide>
      <div className="mb-8 text-center">
        <GlassEyebrow>Avatar 2.0 · complete</GlassEyebrow>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Your customer, and what they need from you
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Built from {report.reviews_analyzed} of your customers&apos; own review
          {report.reviews_analyzed === 1 ? '' : 's'}. Not a demographic. Not a template.
        </p>
        <div className="mt-3 flex justify-center">
          <LowEvidenceBadge
            reviewCount={report.reviews_analyzed}
            corpusSummaryUsed={report.corpus_summary_used ?? false}
            variant="compact"
          />
        </div>
      </div>

      {/* ── The finding FIRST ── */}
      <Component0Hero eyebrow="Primary conversion problem">
        {finding ?? (
          <span className="text-[1.05rem] font-medium text-muted-foreground">
            The evidence read could not be generated for this run. Your score below still stands,
            and you can re-run the analysis any time.
          </span>
        )}
      </Component0Hero>

      {/* ── Trust Gap score beneath the finding, never above it ── */}
      <ScorePillars score={report.forensic_scores.overall} pillars={pillars} />
      {report.thin_corpus && (
        <p className="mt-2.5 text-xs leading-relaxed text-amber-500/90">
          Based on {report.reviews_analyzed} review{report.reviews_analyzed === 1 ? '' : 's'}, a
          thin sample. Treat this read as directional; more reviews sharpen it.
        </p>
      )}

      {/* ── Decision Trigger ── */}
      {trigger ? (
        <GlassPanel strong className="mt-4 p-6">
          <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
            Decision Trigger™
          </div>
          <div className="mb-2.5 font-display text-2xl font-extrabold text-foreground">
            {trigger.name}
          </div>
          {trigger.why && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">{trigger.why}</p>
          )}
          {trigger.evidencePhrases.length > 0 && (
            <>
              <div className="mb-2 mt-4 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground/80">
                Evidence from your reviews
              </div>
              <div className="space-y-1 border-l-2 border-gold-warm/30 pl-3.5">
                {trigger.evidencePhrases.map((phrase) => (
                  <p key={phrase} className="font-mono text-sm text-foreground/70">
                    &ldquo;{phrase}&rdquo;
                  </p>
                ))}
              </div>
            </>
          )}
          <div className="mt-3.5 rounded-xl bg-foreground/[0.04] px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
            <span className="font-bold text-gold-warm">Placement:</span> {trigger.placement}
          </div>
        </GlassPanel>
      ) : (
        <GlassPanel className="mt-4 p-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your Decision Trigger™ needs a richer review corpus than this listing has today. It
            will be ready the moment more of your customers have spoken.
          </p>
        </GlassPanel>
      )}

      {/* ── The four-card profile grid ── */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ProfileCard
          label="How your customer talks"
          heading="Customer vocabulary"
          body={profile.how_they_talk}
        />
        <ProfileCard
          label="Why they're buying today"
          heading="Purchase motivation"
          body={profile.why_buying_now}
        />
        <ProfileCard
          label="What builds trust"
          heading="What earns their trust"
          body={profile.what_builds_trust}
        />
        <ProfileCard
          label="What stops them buying"
          heading="Top objection"
          body={profile.what_stops_them}
        />
      </div>

      <div className="mt-8 text-center">
        <Button
          type="button"
          variant="brand"
          className="min-h-12 rounded-xl px-7 text-[15px] font-extrabold"
          onClick={onSeeBrief}
        >
          See my design brief →
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          The brief your designer or VA acts on today.
        </p>
      </div>
    </V5Stage>
  );
}
