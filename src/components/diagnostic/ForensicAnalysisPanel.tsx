/**
 * ForensicAnalysisPanel
 *
 * The signed-in counterpart to DiagnosticLeadCapture: the "long-running free
 * analysis" a user gets after signup. Given an Amazon ASIN, it runs the
 * `run-forensic-analysis` edge function — which scrapes the listing + reviews and
 * derives a forensic Trust Gap read, a per-dimension evidence interpretation, and
 * the dominant Decision Trigger, all GROUNDED in the seller's real reviews (not
 * their self-report) — then renders the report inline.
 *
 * Inline card (NOT a modal), matching ProductImportCta's convention. The single
 * server call is synchronous (~30-60s); while it is awaited the panel shows a
 * stepped "analysing…" checklist mirroring the server's six stages — a perceived-
 * progress animation, honestly labelled, not a real per-step stream.
 *
 * Thin corpus (the ~8-review /dp cap is normal): when `thin_corpus` is true the
 * report carries a confidence caveat. A 422 ("couldn't analyse this listing") and
 * any other failure surface via a sonner toast + an inline retry affordance.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Microscope,
  Loader2,
  CheckCircle2,
  Circle,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Star,
  Heart,
  Shield,
  RotateCcw,
  Mail,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { parseAsinInput } from '@/utils/asinParser';
import { captureAlphaEvent } from '@/lib/posthogClient';
import {
  buildTrustGap,
  TRUST_GAP_MAX_PER_DIMENSION,
  type TrustGapDimension,
  type TrustGapInputScores,
} from '@/lib/trustGap';
import { DECISION_TRIGGER_TYPES, type DecisionTriggerType } from '@/lib/decisionTrigger';
import { DecisionTriggerPanel } from '@/components/decision-trigger/DecisionTriggerPanel';
import type { DecisionTriggerResult } from '@/components/decision-trigger/types';

/** Forensic pillar scores: each pillar 0-25, overall 0-100 (derived from the corpus). */
interface ForensicScores {
  insight: number;
  distinctive: number;
  empathetic: number;
  authentic: number;
  overall: number;
}

/** One per-dimension evidence read from diagnostic-interpretation-evidence. */
interface InterpretationDimension {
  dimension: string;
  brand_read?: string;
  what_it_measures?: string;
  grounding?: 'evidence' | 'inference';
}

/** The interpretation object echoed by run-forensic-analysis (evidence fn shape). */
interface ForensicInterpretation {
  dimensions?: InterpretationDimension[];
  primaryGapSummary?: string;
}

/** Successful run-forensic-analysis response (shared contract). */
interface ForensicResponse {
  ok: true;
  asin: string;
  reviews_analyzed: number;
  thin_corpus: boolean;
  forensic_scores: ForensicScores;
  primary_gap: TrustGapDimension;
  interpretation: ForensicInterpretation;
  decision_trigger: unknown;
  emailed?: boolean;
  listing: { title?: string; bullets?: string[] };
}

interface ForensicAnalysisPanelProps {
  /**
   * The page's self-report Trust Gap scores (each dimension 0-100 + overall),
   * sent so the server can contrast the seller's self-perception with the
   * evidence-derived read. The forensic scores it returns are derived from the
   * corpus, NOT from this self-report.
   */
  selfReportScores: TrustGapInputScores;
  /** Optional ASIN to pre-fill the input (e.g. a previously imported listing). */
  defaultAsin?: string;
}

type RunStatus = 'idle' | 'running' | 'done' | 'error';

/** Plain divisor turning a displayed /25 pillar back into the 0-100 scale buildTrustGap rescales from. */
const PILLAR_TO_RAW = 100 / TRUST_GAP_MAX_PER_DIMENSION;

/** The six server stages, surfaced as a perceived-progress checklist. */
const PROGRESS_STEPS = [
  'Reading your listing',
  'Pulling your reviews',
  'Reading what your customers mean',
  'Scoring your trust gaps',
  'Matching your fix',
  'Building your brief',
] as const;

/** Advance the visible step roughly every 8s so the bar moves across a ~40-50s run. */
const STEP_INTERVAL_MS = 8000;

const PILLAR_ICON: Record<TrustGapDimension, JSX.Element> = {
  insight: <Lightbulb className="w-4 h-4" />,
  distinctive: <Star className="w-4 h-4" />,
  empathetic: <Heart className="w-4 h-4" />,
  authentic: <Shield className="w-4 h-4" />,
};

const PILLAR_LABEL: Record<TrustGapDimension, string> = {
  insight: 'Insight',
  distinctive: 'Distinctive',
  empathetic: 'Empathetic',
  authentic: 'Authentic',
};

const PILLAR_ORDER: readonly TrustGapDimension[] = ['insight', 'distinctive', 'empathetic', 'authentic'];

/** Narrow an unknown forensic response to the success contract. */
function isForensicResponse(data: unknown): data is ForensicResponse {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.ok !== true || typeof d.asin !== 'string') return false;
  if (typeof d.reviews_analyzed !== 'number' || typeof d.thin_corpus !== 'boolean') return false;
  const s = d.forensic_scores as Record<string, unknown> | undefined;
  if (!s) return false;
  return (['insight', 'distinctive', 'empathetic', 'authentic', 'overall'] as const).every(
    (k) => typeof s[k] === 'number',
  );
}

/**
 * Map the server `decision_trigger` object to the client DecisionTriggerResult.
 * The contract carries the internal snake_case shape from identify-decision-trigger
 * (dominant_type, brand_anchor, evidence_phrases[], placement_instruction,
 * why_this_trigger); tolerate the camelCase variant too. Returns undefined when the
 * shape is unusable so the panel simply omits the trigger rather than rendering junk.
 */
function mapDecisionTrigger(raw: unknown): DecisionTriggerResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const dominant = (r.dominant_type ?? r.dominantType) as unknown;
  const anchor = (r.brand_anchor ?? r.brandAnchor) as unknown;
  const phrases = (r.evidence_phrases ?? r.evidencePhrases) as unknown;
  const placement = (r.placement_instruction ?? r.placementInstruction) as unknown;
  const why = (r.why_this_trigger ?? r.whyThisTrigger) as unknown;

  if (typeof dominant !== 'string' || !DECISION_TRIGGER_TYPES.includes(dominant as DecisionTriggerType)) {
    return undefined;
  }
  if (typeof anchor !== 'string' || typeof placement !== 'string') return undefined;

  return {
    id: typeof r.id === 'string' ? r.id : null,
    dominantType: dominant as DecisionTriggerType,
    brandAnchor: anchor,
    evidencePhrases: Array.isArray(phrases)
      ? phrases.filter((p): p is string => typeof p === 'string')
      : [],
    placementInstruction: placement,
    whyThisTrigger: typeof why === 'string' ? why : '',
  };
}

/** Convert forensic /25 pillars + /100 overall into the buildTrustGap input scale. */
function forensicToInputScores(scores: ForensicScores): TrustGapInputScores {
  return {
    insight: Math.round(scores.insight * PILLAR_TO_RAW),
    distinctive: Math.round(scores.distinctive * PILLAR_TO_RAW),
    empathetic: Math.round(scores.empathetic * PILLAR_TO_RAW),
    authentic: Math.round(scores.authentic * PILLAR_TO_RAW),
    overall: scores.overall,
  };
}

/** Stepped checklist shown while the single server call is awaited. */
function ProgressChecklist({ activeStep }: { activeStep: number }): JSX.Element {
  const pct = Math.min(100, ((activeStep + 1) / PROGRESS_STEPS.length) * 100);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        Analysing your listing… this takes about a minute.
      </div>
      <Progress value={pct} aria-label="Forensic analysis progress" />
      <ul className="space-y-2">
        {PROGRESS_STEPS.map((step, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <li
              key={step}
              className={`flex items-center gap-2 text-sm ${
                done ? 'text-muted-foreground' : active ? 'text-foreground font-medium' : 'text-muted-foreground/50'
              }`}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
              ) : active ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
              ) : (
                <Circle className="w-4 h-4 shrink-0" />
              )}
              {step}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Compact forensic pillar grid — its own render so the report does not re-bill the
 *  interpretation model (the forensic read is already in the response). */
function ForensicScorecard({
  scores,
  reviewsAnalyzed,
  thinCorpus,
}: {
  scores: ForensicScores;
  reviewsAnalyzed: number;
  thinCorpus: boolean;
}): JSX.Element {
  const model = buildTrustGap(forensicToInputScores(scores));
  const byKey = Object.fromEntries(model.dimensions.map((d) => [d.key, d]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold">Your forensic Trust Gap™</h4>
          <p className="text-sm text-muted-foreground">Derived from your real customers, not your self-report.</p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold tabular-nums">
            {model.overall}
            <span className="text-base font-medium text-muted-foreground">/100</span>
          </span>
        </div>
      </div>

      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5">
        <Sparkles className="w-3.5 h-3.5" />
        Grounded in your {reviewsAnalyzed} real review{reviewsAnalyzed === 1 ? '' : 's'}
      </Badge>

      {thinCorpus && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Based on {reviewsAnalyzed} review{reviewsAnalyzed === 1 ? '' : 's'} — a thin sample, so treat this
            read as directional. Importing more reviews sharpens it.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {PILLAR_ORDER.map((key) => {
          const dim = byKey[key];
          return (
            <div key={key} className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {PILLAR_ICON[key]}
                {PILLAR_LABEL[key]}
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {dim?.score ?? 0}
                <span className="text-sm font-medium text-muted-foreground">/{TRUST_GAP_MAX_PER_DIMENSION}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Per-dimension evidence interpretation render (defensive over the evidence-fn shape). */
function InterpretationReport({ interpretation }: { interpretation: ForensicInterpretation }): JSX.Element | null {
  const dims = Array.isArray(interpretation.dimensions) ? interpretation.dimensions : [];
  const hasBody = !!interpretation.primaryGapSummary || dims.some((d) => d.brand_read);
  if (!hasBody) return null;

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold">What your reviews say</h4>
      {dims.map((dim, i) =>
        dim.brand_read ? (
          <div key={`${dim.dimension}-${i}`} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{dim.dimension}</span>
              {dim.grounding === 'inference' && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  inferred
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{dim.brand_read}</p>
          </div>
        ) : null,
      )}
      {interpretation.primaryGapSummary && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-sm leading-relaxed">{interpretation.primaryGapSummary}</p>
        </div>
      )}
    </div>
  );
}

export function ForensicAnalysisPanel({
  selfReportScores,
  defaultAsin,
}: ForensicAnalysisPanelProps): JSX.Element {
  const [input, setInput] = useState(defaultAsin ?? '');
  const [status, setStatus] = useState<RunStatus>('idle');
  const [activeStep, setActiveStep] = useState(0);
  const [report, setReport] = useState<ForensicResponse | null>(null);

  // F1: one ASIN per run — take the first parsed.
  const asin = parseAsinInput(input)[0];

  const runAnalysis = async (): Promise<void> => {
    if (!asin) return;

    setStatus('running');
    setActiveStep(0);
    setReport(null);

    // Perceived-progress: advance the visible step on a timer during the single
    // await. The server call is synchronous; this is honest "analysing…" pacing.
    const timer = window.setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1));
    }, STEP_INTERVAL_MS);

    // asin-presence only — never the ASIN value or any PII.
    captureAlphaEvent('forensic_analysis_started', { has_asin: true });

    try {
      const { data, error } = await supabase.functions.invoke('run-forensic-analysis', {
        body: { asin, self_report_scores: selfReportScores },
      });

      if (error || (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false)) {
        const message =
          (data as { error?: string })?.error ?? error?.message ?? 'unknown error';
        console.error('[ForensicAnalysisPanel] analysis failed:', message);
        toast.error("We couldn't analyse this listing. Check the ASIN and try again.");
        captureAlphaEvent('forensic_analysis_completed', { ok: false });
        setStatus('error');
        return;
      }

      if (!isForensicResponse(data)) {
        console.error('[ForensicAnalysisPanel] unexpected response shape:', data);
        toast.error('We hit a problem reading your forensic report. Please try again.');
        captureAlphaEvent('forensic_analysis_completed', { ok: false });
        setStatus('error');
        return;
      }

      setReport(data);
      setStatus('done');
      captureAlphaEvent('forensic_analysis_completed', {
        ok: true,
        reviews_analyzed: data.reviews_analyzed,
        thin_corpus: data.thin_corpus,
        primary_gap: data.primary_gap,
        overall_score: data.forensic_scores.overall,
        has_decision_trigger: !!mapDecisionTrigger(data.decision_trigger),
      });
    } catch (err: unknown) {
      console.error('[ForensicAnalysisPanel] unexpected error:', err);
      toast.error('We could not run your forensic analysis right now. Please try again.');
      captureAlphaEvent('forensic_analysis_completed', { ok: false });
      setStatus('error');
    } finally {
      window.clearInterval(timer);
    }
  };

  const isRunning = status === 'running';
  const trigger = report ? mapDecisionTrigger(report.decision_trigger) : undefined;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Microscope className="w-5 h-5 text-primary" />
          Run your forensic analysis
        </CardTitle>
        <CardDescription>
          We'll read your live Amazon listing and its reviews, then return an evidence-grounded Trust Gap
          read, your dominant Decision Trigger, and what to fix first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status !== 'done' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="forensic-asin">ASIN or Amazon URL</Label>
              <Textarea
                id="forensic-asin"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={'B0CJBQ7F5C\nhttps://www.amazon.com/dp/B0CJBQ7F5C'}
                rows={2}
                className="font-mono text-sm"
                disabled={isRunning}
              />
              {input.trim() !== '' && !asin && (
                <p className="text-sm text-amber-600">That doesn't look like a valid ASIN or Amazon URL yet.</p>
              )}
            </div>

            {isRunning ? (
              <ProgressChecklist activeStep={activeStep} />
            ) : (
              <Button className="w-full" disabled={!asin} onClick={runAnalysis}>
                <Microscope className="w-4 h-4 mr-2" />
                Run my forensic analysis
              </Button>
            )}
          </div>
        )}

        {status === 'done' && report && (
          <div className="space-y-6">
            {report.emailed && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                <Mail className="w-4 h-4 shrink-0" />
                <span>We've emailed this report to you, so you can come back to it any time.</span>
              </div>
            )}
            <ForensicScorecard
              scores={report.forensic_scores}
              reviewsAnalyzed={report.reviews_analyzed}
              thinCorpus={report.thin_corpus}
            />

            <InterpretationReport interpretation={report.interpretation} />

            {trigger && (
              <DecisionTriggerPanel
                scores={selfReportScores}
                evidence={undefined}
                evidenceKey={undefined}
                sessionId={report.asin}
                isAuthenticated={true}
                result={trigger}
              />
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setStatus('idle');
                setReport(null);
              }}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Analyse another listing
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
