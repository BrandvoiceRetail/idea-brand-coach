/**
 * V5Alpha — the /v5 "Avatar 2.0 build theatre" alpha surface.
 *
 * A nav-less state machine: entry → fetching → building (the theatre) →
 * co-sign → diagnosing → results → brief → save, with a cold-start branch
 * when the corpus is too thin. All data is REAL: the corpus comes from the
 * seller's imported reviews, the theatre is driven by useForensicAvatarBuild's
 * per-stage status (never fake timers over fake data), the score + trigger
 * come from run-forensic-analysis, and the brief from fixService.generateBrief.
 * Anywhere the engine cannot ground an output the surface says so honestly.
 *
 * The `.dark` wrapper pins the dark-liquid-glass register for this subtree
 * regardless of the app-wide theme toggle (this surface is dark by design).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseProductDataService } from '@/services/SupabaseProductDataService';
import { ForensicBuildService } from '@/services/ForensicBuildService';
import { generateBrief } from '@/services/v4/fixService';
import { ensureSession, ensureV5Scope } from '@/services/v5/v5ScopeService';
import { useForensicAvatarBuild } from '@/hooks/useForensicAvatarBuild';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { ForensicStage } from '@/types/forensicBuild';
import type { NeedsInputItem } from '@/types/forensicBuild';
import type { BriefSlots } from '@/types/v4Fix';
import type { ClaimGateItem } from '@/types/v4Analyse';
import type { ImportedProduct } from '@/services/interfaces/IProductDataService';
import { Loader2 } from 'lucide-react';
import { V5Stage, V5TopBar } from '@/components/v5/V5Chrome';
import { EntryScreen } from '@/components/v5/EntryScreen';
import { CorpusFetch } from '@/components/v5/CorpusFetch';
import { BuildTheatre } from '@/components/v5/BuildTheatre';
import { ResultsScreen } from '@/components/v5/ResultsScreen';
import { V5BriefScreen } from '@/components/v5/V5BriefScreen';
import { briefToText } from '@/components/v5/briefExport';
import { SaveNext } from '@/components/v5/SaveNext';
import { ColdStart } from '@/components/v5/ColdStart';
import { GlassEyebrow } from '@/components/v2/problem-solver/glass';
import { BEAT_ORDER, buildBeat, buildCoSignRead, type StageContents } from '@/components/v5/beatModel';
import {
  isForensicReport,
  mapTrigger,
  type V5DecisionTrigger,
  type V5ForensicReport,
} from '@/components/v5/forensicReport';
import { Button } from '@/components/ui/button';

type Phase =
  | 'entry'
  | 'fetching'
  | 'building'
  | 'diagnosing'
  | 'results'
  | 'brief'
  | 'save'
  | 'coldstart';

/** Theatre pacing (presentation only — the compute is the hook's). */
const FIRST_BEAT_DELAY_MS = 500;
const BEAT_DELAY_MS = 2600;
const POST_FETCH_PAUSE_MS = 900;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export default function V5Alpha(): JSX.Element {
  // ── Services (stable instances) ─────────────────────────────────────────────
  const productService = useMemo(() => new SupabaseProductDataService(), []);
  const buildService = useMemo(() => new ForensicBuildService(), []);

  // ── Machine state ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('entry');
  const [express, setExpress] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const [asin, setAsin] = useState<string | null>(null);
  const [listingTitle, setListingTitle] = useState<string | null>(null);
  const [fetchStep, setFetchStep] = useState(0);
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [reviewsString, setReviewsString] = useState<string | null>(null);

  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [pendingRun, setPendingRun] = useState<{ reviews: string; nonce: number } | null>(null);
  const startedNonceRef = useRef<number | null>(null);

  const [stageContents, setStageContents] = useState<StageContents>({});
  const stageFetchRef = useRef<Set<ForensicStage>>(new Set());
  const [shownBeats, setShownBeats] = useState(0);
  const [paused, setPaused] = useState(false);
  const [skipAll, setSkipAll] = useState(false);
  const [coSigning, setCoSigning] = useState(false);

  const [report, setReport] = useState<V5ForensicReport | null>(null);
  const [trigger, setTrigger] = useState<V5DecisionTrigger | undefined>(undefined);
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null);

  const [brief, setBrief] = useState<BriefSlots | null>(null);
  const [claims, setClaims] = useState<ClaimGateItem[]>([]);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefNeedsInput, setBriefNeedsInput] = useState<NeedsInputItem[] | null>(null);

  const [products, setProducts] = useState<ImportedProduct[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    [],
  );

  const {
    stageStatus,
    isRunning,
    needsInput,
    runError,
    runBuild,
    approve,
  } = useForensicAvatarBuild(avatarId);

  // ── Entry: prefill for returning users ──────────────────────────────────────
  useEffect(() => {
    captureAlphaEvent('v5_entry_viewed', {});
    let cancelled = false;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      setIsAnonymous(session.user.is_anonymous === true);
      try {
        const stored = await productService.getProducts();
        if (!cancelled) setProducts(stored);
      } catch (err) {
        console.error('[V5Alpha] product prefill failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only: prefill + the entry event fire once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Per-run reset ────────────────────────────────────────────────────────────
  const resetRunState = useCallback((): void => {
    setStageContents({});
    stageFetchRef.current = new Set();
    setShownBeats(0);
    setPaused(false);
    setSkipAll(false);
    setCoSigning(false);
    setReport(null);
    setTrigger(undefined);
    setDiagnoseError(null);
    setBrief(null);
    setClaims([]);
    setBriefError(null);
    setBriefNeedsInput(null);
    setPendingRun(null);
    setReviewCount(null);
    setReviewsString(null);
    setFetchStep(0);
  }, []);

  // ── The full ASIN run (entry + express + competitor paths) ─────────────────
  const startRun = useCallback(
    async (runAsin: string, options?: { express?: boolean }): Promise<void> => {
      const isExpress = options?.express ?? false;
      resetRunState();
      setExpress(isExpress);
      setAsin(runAsin);
      setListingTitle(null);
      setIsStarting(true);
      captureAlphaEvent('v5_run_started', { express: isExpress });

      try {
        await ensureSession();
        const { data: { user } } = await supabase.auth.getUser();
        setIsAnonymous(user?.is_anonymous === true);

        setPhase('fetching');
        setFetchStep(0);

        const imported = await productService.importProducts([runAsin]);
        const item = imported.results.find((r) => r.asin?.toUpperCase() === runAsin.toUpperCase());
        if (!item || !item.ok) {
          toast.error(
            item?.error ??
              'No Amazon listing found for that ASIN. Double-check it and try again.',
          );
          setPhase('entry');
          return;
        }
        setListingTitle(item.title ?? null);
        setFetchStep(1);

        const reviews = await productService.getAllReviewsAsString();
        const count = reviews ? reviews.split('\n').filter(Boolean).length : 0;
        setReviewsString(reviews);
        setReviewCount(count);
        captureAlphaEvent('v5_corpus_ready', { review_count: count, express: isExpress });

        if (count === 0) {
          captureAlphaEvent('v5_coldstart_shown', { reason: 'no_reviews' });
          setPhase('coldstart');
          return;
        }
        setFetchStep(2);

        const scope = await ensureV5Scope();
        setAvatarId(scope.avatarId);
        setFetchStep(3);

        if (!isExpress && !reducedMotion) await sleep(POST_FETCH_PAUSE_MS);
        setPhase('building');
        setPendingRun({ reviews, nonce: Date.now() });
      } catch (err) {
        console.error('[V5Alpha] run start failed:', err);
        toast.error('I could not read that listing right now. Please try again.');
        setPhase('entry');
      } finally {
        setIsStarting(false);
      }
    },
    [productService, resetRunState, reducedMotion],
  );

  // ── Pasted-voice run (cold start option 1 — no listing, no score) ──────────
  const startPastedRun = useCallback(
    async (text: string): Promise<void> => {
      resetRunState();
      setExpress(false);
      setAsin(null);
      setListingTitle(null);
      captureAlphaEvent('v5_run_started', { express: false, source: 'pasted_voice' });
      try {
        await ensureSession();
        const scope = await ensureV5Scope();
        setAvatarId(scope.avatarId);
        setReviewsString(text);
        setPhase('building');
        setPendingRun({ reviews: text, nonce: Date.now() });
      } catch (err) {
        console.error('[V5Alpha] pasted run failed:', err);
        toast.error('I could not start the read right now. Please try again.');
      }
    },
    [resetRunState],
  );

  // ── Fire runBuild once the avatar-bound hook can see the id ────────────────
  useEffect(() => {
    if (phase !== 'building' || !avatarId || !pendingRun) return;
    if (startedNonceRef.current === pendingRun.nonce) return;
    startedNonceRef.current = pendingRun.nonce;
    void runBuild(pendingRun.reviews);
  }, [phase, avatarId, pendingRun, runBuild]);

  // ── Pull each stage's REAL artifact the moment its stage completes ─────────
  useEffect(() => {
    if (!avatarId) return;
    (Object.keys(stageStatus) as ForensicStage[]).forEach((stage) => {
      if (stageStatus[stage] !== 'done') return;
      if (stageContents[stage] || stageFetchRef.current.has(stage)) return;
      stageFetchRef.current.add(stage);
      buildService
        .getStageArtifact(stage, avatarId)
        .then((content) => {
          if (content) setStageContents((prev) => ({ ...prev, [stage]: content } as StageContents));
        })
        .catch((err) => {
          console.error(`[V5Alpha] could not read the ${stage} artifact:`, err);
          stageFetchRef.current.delete(stage);
        });
    });
  }, [stageStatus, avatarId, stageContents, buildService]);

  // ── Beats (presentation order) + reveal pacing ──────────────────────────────
  const beats = useMemo(
    () => BEAT_ORDER.map((b, i) => buildBeat(b.id, i + 1, stageContents)),
    [stageContents],
  );

  const revealNext = useCallback((): void => {
    setShownBeats((n) => {
      const slot = BEAT_ORDER[n];
      if (!slot) return n;
      captureAlphaEvent('v5_stage_revealed', { beat: slot.id, index: n + 1, express });
      return n + 1;
    });
  }, [express]);

  useEffect(() => {
    if (phase !== 'building' || paused) return;
    if (shownBeats >= BEAT_ORDER.length) return;
    if (!beats[shownBeats]) return; // that stage has not really computed yet
    if (express || skipAll) {
      revealNext();
      return;
    }
    if (reducedMotion) return; // manual Next button instead of auto pacing
    const t = window.setTimeout(revealNext, shownBeats === 0 ? FIRST_BEAT_DELAY_MS : BEAT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [phase, paused, shownBeats, beats, express, skipAll, reducedMotion, revealNext]);

  // ── Grounding gap → the honest cold-start branch ────────────────────────────
  useEffect(() => {
    if (!needsInput) return;
    if (phase !== 'building' && phase !== 'fetching') return;
    captureAlphaEvent('v5_coldstart_shown', { reason: 'needs_input' });
    setPhase('coldstart');
  }, [needsInput, phase]);

  // ── Co-sign → the one-call diagnostic ───────────────────────────────────────
  const runDiagnostic = useCallback(async (): Promise<void> => {
    if (!asin) {
      // Pasted-voice run: there is no live listing to score — say so, move on.
      toast.info(
        'A Trust Gap score needs a live listing. Your brief still writes from the words you pasted.',
      );
      setPhase('brief');
      return;
    }
    setPhase('diagnosing');
    setDiagnoseError(null);
    try {
      const { data, error } = await supabase.functions.invoke('run-forensic-analysis', {
        body: { asin },
      });
      if (error || (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false)) {
        const message =
          (data as { error?: string } | null)?.error ?? error?.message ?? 'unknown error';
        console.error('[V5Alpha] diagnostic failed:', message);
        setDiagnoseError('I could not score this listing right now.');
        return;
      }
      if (!isForensicReport(data)) {
        console.error('[V5Alpha] unexpected diagnostic shape:', data);
        setDiagnoseError('I hit a problem reading your result. Please try again.');
        return;
      }
      const mapped = mapTrigger(data.decision_trigger);
      setReport(data);
      setTrigger(mapped);
      setPhase('results');
      captureAlphaEvent('v5_results_viewed', {
        overall: data.forensic_scores.overall,
        primary_gap: data.primary_gap,
        thin_corpus: data.thin_corpus,
        reviews_analyzed: data.reviews_analyzed,
        has_trigger: !!mapped,
      });
    } catch (err) {
      console.error('[V5Alpha] diagnostic error:', err);
      setDiagnoseError('I could not score this listing right now.');
    }
  }, [asin]);

  const handleCoSign = useCallback(
    (soundsRight: boolean): void => {
      setCoSigning(true);
      captureAlphaEvent('v5_cosign_confirmed', { answer: soundsRight ? 'yes' : 'not_quite' });
      if (soundsRight) {
        // Approval stamps the build state; a failure is logged, never blocking.
        void approve().catch(() => undefined);
      }
      void runDiagnostic().finally(() => setCoSigning(false));
    },
    [approve, runDiagnostic],
  );

  // ── Brief ────────────────────────────────────────────────────────────────────
  const loadBrief = useCallback(async (): Promise<void> => {
    if (!avatarId) return;
    setBriefLoading(true);
    setBriefError(null);
    setBriefNeedsInput(null);
    try {
      const res = await generateBrief({ touchpointId: 'amazon_listing_copy', avatarId });
      if (res.status === 'ok') {
        setBrief(res.data);
        setClaims(res.data.claimGate);
        captureAlphaEvent('v5_brief_viewed', {
          claim_count: res.data.claimGate.length,
          bullet_count: res.data.bullets.length,
        });
      } else if (res.status === 'needs_input') {
        setBriefNeedsInput(res.needs_input);
      } else {
        setBriefError(res.error);
      }
    } finally {
      setBriefLoading(false);
    }
  }, [avatarId]);

  const goBrief = useCallback((): void => {
    setPhase('brief');
    if (!brief && !briefLoading) void loadBrief();
  }, [brief, briefLoading, loadBrief]);

  const handleConfirmClaim = useCallback((_claim: ClaimGateItem, index: number): void => {
    setClaims((prev) =>
      prev.map((c, i) => (i === index ? { ...c, status: 'confirmed' as const } : c)),
    );
  }, []);

  const handleExportBrief = useCallback((): void => {
    if (!brief) return;
    const text = briefToText({ ...brief, claimGate: claims }, listingTitle ?? asin ?? 'your listing');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design-brief.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [brief, claims, listingTitle, asin]);

  // ── Save & next ──────────────────────────────────────────────────────────────
  const goSave = useCallback(async (): Promise<void> => {
    setPhase('save');
    try {
      await ensureSession();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAnonymous(user?.is_anonymous === true);
      const stored = await productService.getProducts();
      setProducts(stored);
    } catch (err) {
      console.error('[V5Alpha] save-screen load failed:', err);
    }
  }, [productService]);

  const handleSaveEmail = useCallback(async (email: string): Promise<void> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) {
        setSaveError(error.message);
        captureAlphaEvent('v5_saved', { ok: false });
        return;
      }
      setSaved(true);
      captureAlphaEvent('v5_saved', { ok: true });
    } catch (err) {
      console.error('[V5Alpha] save failed:', err);
      setSaveError('I could not save your work just now. Please try again.');
      captureAlphaEvent('v5_saved', { ok: false });
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleExpressRun = useCallback(
    (nextAsin: string, title: string | null): void => {
      captureAlphaEvent('v5_express_run', {});
      setListingTitle(title);
      void startRun(nextAsin, { express: true });
    },
    [startRun],
  );

  // ── Retry the build with the same corpus ────────────────────────────────────
  const retryBuild = useCallback((): void => {
    if (!reviewsString) return;
    setPendingRun({ reviews: reviewsString, nonce: Date.now() });
  }, [reviewsString]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const otherProducts = products.filter((p) => p.asin.toUpperCase() !== (asin ?? '').toUpperCase());
  const prefillProduct = products[0];

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <V5TopBar />

      {phase === 'entry' && (
        <EntryScreen
          // Remount when the async product prefill lands so the input picks it up.
          key={prefillProduct?.asin ?? 'blank'}
          defaultValue={prefillProduct?.asin ?? ''}
          defaultTitle={prefillProduct?.title || null}
          isStarting={isStarting}
          onStart={(a) => void startRun(a)}
          onColdStart={() => {
            captureAlphaEvent('v5_coldstart_shown', { reason: 'self_selected' });
            setPhase('coldstart');
          }}
        />
      )}

      {phase === 'fetching' && (
        <CorpusFetch
          listingLabel={listingTitle ?? asin ?? ''}
          stepIndex={fetchStep}
          reviewCount={reviewCount}
          instant={express || reducedMotion}
        />
      )}

      {phase === 'building' && (
        <BuildTheatre
          beats={beats}
          shownBeats={shownBeats}
          isRunning={isRunning}
          runError={runError}
          onRetry={retryBuild}
          showCoSign={shownBeats >= BEAT_ORDER.length}
          coSignRead={buildCoSignRead(stageContents)}
          onCoSign={handleCoSign}
          coSignDisabled={coSigning}
          paused={paused}
          onTogglePause={() => setPaused((p) => !p)}
          onSkip={() => setSkipAll(true)}
          reducedMotion={reducedMotion}
          onNext={revealNext}
        />
      )}

      {phase === 'diagnosing' && (
        <V5Stage className="text-center">
          <GlassEyebrow>Avatar 2.0 · complete</GlassEyebrow>
          <h1 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            Your customer profile is built.
          </h1>
          {diagnoseError ? (
            <div className="mx-auto mt-6 max-w-[440px] rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-left">
              <p className="mb-3 text-sm leading-relaxed text-destructive">{diagnoseError}</p>
              <div className="flex gap-2.5">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => void runDiagnostic()}>
                  Try again
                </Button>
                <Button type="button" variant="ghost" className="rounded-xl text-muted-foreground" onClick={goBrief}>
                  Skip to the brief
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex items-center justify-center gap-2.5 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin text-gold-warm" />
              Now reading your Trust Gap™ and your Decision Trigger™. This takes about a minute.
            </div>
          )}
        </V5Stage>
      )}

      {phase === 'results' && report && (
        <ResultsScreen report={report} trigger={trigger} onSeeBrief={goBrief} />
      )}

      {phase === 'brief' && (
        <V5BriefScreen
          brief={brief}
          claims={claims}
          isLoading={briefLoading}
          error={briefError}
          needsInput={briefNeedsInput}
          onConfirmClaim={handleConfirmClaim}
          onExport={handleExportBrief}
          onRetry={() => void loadBrief()}
          onContinue={() => void goSave()}
          onBack={() => setPhase(report ? 'results' : 'building')}
        />
      )}

      {phase === 'save' && (
        <SaveNext
          isAnonymous={isAnonymous}
          saved={saved}
          saveError={saveError}
          isSaving={isSaving}
          onSaveEmail={(email) => void handleSaveEmail(email)}
          otherProducts={otherProducts}
          onExpressRun={handleExpressRun}
          onStartOver={() => {
            resetRunState();
            setAsin(null);
            setListingTitle(null);
            setPhase('entry');
          }}
        />
      )}

      {phase === 'coldstart' && (
        <ColdStart
          needsInput={needsInput}
          onPasteVoice={(text) => void startPastedRun(text)}
          onCompetitor={(competitorAsin) => void startRun(competitorAsin)}
          onSaveAndNotify={() => void goSave()}
          onBack={() => setPhase('entry')}
        />
      )}
    </div>
  );
}
