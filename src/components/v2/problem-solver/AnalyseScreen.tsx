/**
 * S4 — Analyse (the 6-tool agentic run).
 *
 * Calls the LIVE run-forensic-analysis edge fn with { asin, self_report_scores }
 * (signed-in only — the shell gates auth before this screen renders). While the
 * single synchronous call (~30-60s) is awaited, a six-step perceived-progress
 * checklist advances on an 8s timer — the SAME pattern ForensicAnalysisPanel uses,
 * honestly labelled "Analysing…", not a real per-step stream. On success the
 * report is handed up and the user advances to S5; failures toast + offer retry.
 *
 * LIVE-WIRED: the forensic engine is the real backend. Nothing here is mocked.
 */

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Loader2, CheckCircle2, Circle, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { TrustGapInputScores } from '@/lib/trustGap';
import { PS_COLORS } from './theme';
import { Eyebrow, ScreenHeading, Lede, GoldButton } from './primitives';
import { isForensicResponse, type ForensicResponse } from './types';
import { mapDecisionTrigger } from './forensicMapping';

interface AnalyseScreenProps {
  asin: string;
  selfReport: TrustGapInputScores;
  /** Hand the completed report up and advance to S5. */
  onComplete: (report: ForensicResponse) => void;
  /** Continue when a report already exists (re-entry). */
  onContinue: () => void;
  existingReport: ForensicResponse | null;
}

/** The six server stages, surfaced as a perceived-progress checklist (demo S4). */
const PROGRESS_STEPS = [
  { tool: 'read_listing', label: 'Reading your listing' },
  { tool: 'fetch_reviews', label: 'Pulling your customer reviews' },
  { tool: 'analyse_reviews', label: 'Reading what your customers really mean' },
  { tool: 'score_trust_gaps', label: 'Scoring the four trust signals' },
  { tool: 'match_fix_to_customer', label: 'Matching the fix to your customer' },
  { tool: 'generate_brief', label: 'Generating your design brief + copy' },
] as const;

const STEP_INTERVAL_MS = 8000;

type RunStatus = 'idle' | 'running' | 'done' | 'error';

export function AnalyseScreen({
  asin,
  selfReport,
  onComplete,
  onContinue,
  existingReport,
}: AnalyseScreenProps): JSX.Element {
  const [status, setStatus] = useState<RunStatus>(existingReport ? 'done' : 'idle');
  const [activeStep, setActiveStep] = useState(0);
  const startedRef = useRef(false);

  const runAnalysis = async (): Promise<void> => {
    setStatus('running');
    setActiveStep(0);

    const timer = window.setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1));
    }, STEP_INTERVAL_MS);

    // asin-presence only — never the ASIN value or any PII.
    captureAlphaEvent('forensic_analysis_started', { has_asin: true });

    try {
      const { data, error } = await supabase.functions.invoke('run-forensic-analysis', {
        body: { asin, self_report_scores: selfReport },
      });

      if (error || (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false)) {
        const message = (data as { error?: string })?.error ?? error?.message ?? 'unknown error';
        console.error('[AnalyseScreen] analysis failed:', message);
        toast.error("We couldn't analyse this listing. Check the ASIN and try again.");
        captureAlphaEvent('forensic_analysis_completed', { ok: false });
        setStatus('error');
        return;
      }

      if (!isForensicResponse(data)) {
        // MF-5: log only the structural shape, never the values — the forensic
        // response can carry review/listing content.
        console.error('[AnalyseScreen] unexpected response shape:', {
          type: typeof data,
          keys: data && typeof data === 'object' ? Object.keys(data as Record<string, unknown>) : null,
        });
        toast.error('We hit a problem reading your forensic report. Please try again.');
        captureAlphaEvent('forensic_analysis_completed', { ok: false });
        setStatus('error');
        return;
      }

      captureAlphaEvent('forensic_analysis_completed', {
        ok: true,
        reviews_analyzed: data.reviews_analyzed,
        thin_corpus: data.thin_corpus,
        primary_gap: data.primary_gap,
        overall_score: data.forensic_scores.overall,
        has_decision_trigger: !!mapDecisionTrigger(data.decision_trigger),
      });
      setStatus('done');
      onComplete(data);
    } catch (err: unknown) {
      console.error('[AnalyseScreen] unexpected error:', err);
      toast.error('We could not run your forensic analysis right now. Please try again.');
      captureAlphaEvent('forensic_analysis_completed', { ok: false });
      setStatus('error');
    } finally {
      window.clearInterval(timer);
    }
  };

  // Auto-start the run once on first arrival (no existing report). The ref guards
  // against React 18 StrictMode double-invocation and re-renders.
  useEffect(() => {
    if (existingReport || startedRef.current) return;
    startedRef.current = true;
    void runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.min(100, ((activeStep + 1) / PROGRESS_STEPS.length) * 100);
  const isRunning = status === 'running';

  return (
    <div>
      <Eyebrow>Every finding is backed by what it reads</Eyebrow>
      <ScreenHeading accent={isRunning ? '' : 'complete.'}>
        {isRunning ? `Analysing your listing…` : status === 'done' ? 'Analysis' : 'Forensic analysis'}
      </ScreenHeading>
      <Lede>
        {isRunning
          ? 'You see what the app is doing — every finding is backed by your listing and its reviews. This takes about a minute.'
          : status === 'done'
            ? 'Six tools ran against your listing and your reviews. Here is what they found.'
            : 'We will read your live Amazon listing and its reviews, then derive your evidence-grounded Trust Gap.'}
      </Lede>

      <div className="mb-3.5 h-1.5 overflow-hidden rounded-full border bg-white" style={{ borderColor: PS_COLORS.line }}>
        <span
          className="block h-full transition-[width] duration-500"
          style={{ width: `${status === 'done' ? 100 : pct}%`, background: PS_COLORS.gold }}
        />
      </div>

      <ul className="space-y-3">
        {PROGRESS_STEPS.map((step, i) => {
          const done = status === 'done' || i < activeStep;
          const active = isRunning && i === activeStep;
          return (
            <li key={step.tool} className="flex items-start gap-3">
              <span
                className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border"
                style={
                  done
                    ? { background: PS_COLORS.greenLight, borderColor: '#a6e0bf', color: PS_COLORS.green }
                    : active
                      ? { background: PS_COLORS.goldLight, borderColor: PS_COLORS.gold, color: PS_COLORS.warn }
                      : { background: '#fff', borderColor: PS_COLORS.line, color: PS_COLORS.g500 }
                }
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </span>
              <div className={done || active ? 'opacity-100' : 'opacity-40'}>
                <div className="font-mono text-[11px] font-bold" style={{ color: PS_COLORS.navy }}>
                  {step.tool}
                  <span style={{ color: PS_COLORS.g500 }}>()</span>
                </div>
                <div className="text-[13px] font-semibold" style={{ color: PS_COLORS.navy }}>
                  {step.label}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {status === 'done' && (
        <div className="mt-5 flex justify-end">
          <GoldButton onClick={onContinue}>
            See your customer profile
            <ArrowRight className="h-4 w-4" />
          </GoldButton>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-5 flex justify-center">
          <GoldButton
            onClick={() => {
              startedRef.current = true;
              void runAnalysis();
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </GoldButton>
        </div>
      )}
    </div>
  );
}
