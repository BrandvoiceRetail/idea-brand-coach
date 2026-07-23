/**
 * ResultsScreen — /v5 step ④: the finding FIRST (Component 0), the Trust Gap™
 * score + four pillar bars BENEATH it (never score-first), then the Decision
 * Trigger™ card and the four-card customer profile grid. Every value comes
 * from the run-forensic-analysis response; degraded sections render honest
 * notes, never invented copy. Brand anchors are stripped before this renders.
 */
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Component0Hero,
  GlassEyebrow,
  GlassPanel,
  ScorePillars,
  type PillarRow,
} from '@/components/v2/problem-solver/glass';
import { V5Stage } from './V5Chrome';
import {
  evidenceByDimension,
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
  // Per-pillar citations the engine already computed and the app used to drop. Kept out of the
  // main flow (PR #51 deliberately reduced evidence-count noise) and offered on demand instead.
  const evidence = evidenceByDimension(report);
  const evidenceCount = evidence.reduce((n, d) => n + d.citations.length, 0);
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
          Built from what your customers actually say about your product.
        </p>
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
      {/* The ONE evidence caveat in the whole flow. Sits under the score because
          that is where a reader calibrates how much to trust it. Deliberately
          carries no review count: the number was being repeated three times over
          and reads as us auditing ourselves rather than helping the seller. */}
      {report.thin_corpus && (
        <p className="mt-2.5 text-xs leading-relaxed text-amber-500/90">
          A thin sample so far. Treat this read as directional; more customer voice sharpens it.
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

      {/* ── See all the evidence (collapsed by default; the full per-pillar citations
          the engine computes, so a sceptical seller can check the read against their
          own reviews). Answers "give the user access to all the review quotes". ── */}
      {evidence.length > 0 && (
        <Collapsible className="mt-4">
          <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-xl bg-foreground/[0.04] px-4 py-3 text-left text-[13px] font-bold text-muted-foreground transition hover:bg-foreground/[0.07]">
            <span>See all the evidence behind this read</span>
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground/70 group-data-[state=open]:hidden">
              {evidenceCount} quote{evidenceCount === 1 ? '' : 's'} ↓
            </span>
            <span className="hidden text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground/70 group-data-[state=open]:inline">
              Hide ↑
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 px-1 pt-4">
            {evidence.map((dim) => (
              <div key={dim.dimension}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-foreground/80">
                    {dim.dimension}
                  </span>
                  <span
                    className={
                      dim.grounding === 'evidence'
                        ? 'rounded-full bg-gold-warm/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-warm'
                        : 'rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70'
                    }
                  >
                    {dim.grounding === 'evidence' ? 'Grounded in evidence' : 'Inference'}
                  </span>
                </div>
                <div className="space-y-1 border-l-2 border-gold-warm/30 pl-3.5">
                  {dim.citations.map((c, i) => (
                    <p key={i} className="font-mono text-[13px] leading-relaxed text-foreground/70">
                      &ldquo;{c.quote_or_observation}&rdquo;
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

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
