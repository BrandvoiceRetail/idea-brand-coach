/**
 * AssetDetailTabs (S-14) — Loop-3 per-asset working surface.
 *
 * WHAT: One funnel asset opened into three tabs — `image-prompt` (a ready-to-
 * paste generation prompt), `design-brief` (the 7-slot brief with claim-gated
 * copy, via the canonical MoveBriefClaimGate surface), and `check-asset` (audit
 * the asset against the avatar + Signature, then record an on-brand / off-brand
 * verdict through a handler).
 *
 * WHY: This is where the Diagnose→Analyse→Fix spine does the per-touchpoint work
 * — turn a chosen positioning move into the actual asset, then prove the asset is
 * on-brand before it ships. The audit is the gate; recording the verdict closes
 * the loop and feeds the funnel map.
 *
 * NO FABRICATION (the production bar): this surface is presentational and renders
 * only the real values the parent passes in. Every tab has explicit loading /
 * error / empty states — when an engine is in flight we show a skeleton, when it
 * errored we show an honest retry, and when there is no result yet we say so. We
 * NEVER synthesise a prompt, a brief, or an audit score to fill a tab.
 *
 * The parent (V4Fix) owns the engine calls (generate_canvas / generate_brief /
 * audit_asset), the retry wiring, the claim-confirm state, and persistence of the
 * recorded verdict (record_assessment).
 */
import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Image as ImageIcon,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { MoveBriefClaimGate } from '@/components/v4/analyse/MoveBriefClaimGate';
import { GroundedStrip, type GroundedField } from '@/components/v4/GroundedStrip';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { AssetDetail, AuditResult, BriefSlots } from '@/types/v4Fix';
import type { ClaimGateItem } from '@/types/v4Analyse';
import { ASSET_DETAIL_EVENTS, type AssetDetailEvent } from './assetDetailEvents';

/** Which tab is showing — also the value passed to the tab-view event. */
export type AssetTabId = 'image-prompt' | 'design-brief' | 'check-asset';

/** The verdict the user records after the check-asset audit. */
export type AssetVerdict = 'on_brand' | 'off_brand';

function emit(
  name: AssetDetailEvent,
  props?: Record<string, string | number | boolean | null>,
): void {
  captureAlphaEvent(name, props);
}

export interface AssetDetailTabsProps {
  /** The funnel asset being worked on. */
  asset: AssetDetail;

  /**
   * Which brand fields power the generated output (prompt + brief), each marked
   * present or missing. Drives the "Grounded in…" strip; empty/omitted →
   * honest "not grounded yet" state (never a fabricated checkmark).
   */
  grounded?: GroundedField[];

  // ── image-prompt tab ────────────────────────────────────────────────────────
  /** Generated image prompt; null = none yet (honest empty state). */
  imagePrompt?: string | null;
  /** True while generate_canvas is in flight. */
  imagePromptLoading?: boolean;
  /** Hard error from the prompt engine (null = none). */
  imagePromptError?: string | null;
  /** Generate / regenerate the image prompt. */
  onGenerateImagePrompt?: () => void;

  // ── design-brief tab ─────────────────────────────────────────────────────────
  /** The 7-slot brief for this asset; null = none yet. */
  brief?: BriefSlots | null;
  /** True while generate_brief is in flight. */
  briefLoading?: boolean;
  /** Hard error from the brief engine (null = none). */
  briefError?: string | null;
  /** Generate / retry the brief. */
  onGenerateBrief?: () => void;
  /** Promote a single product claim to confirmed (claim-gated copy). */
  onConfirmClaim?: (claim: ClaimGateItem, index: number) => void;
  /** Export the brief (unconfirmed claims travel flagged, never as fact). */
  onExportBrief?: () => void;

  // ── check-asset tab ──────────────────────────────────────────────────────────
  /** Audit verdict; defaults to `asset.audit`. null = not checked yet. */
  audit?: AuditResult | null;
  /** True while audit_asset is in flight. */
  auditLoading?: boolean;
  /** Hard error from the audit engine (null = none). */
  auditError?: string | null;
  /** Run (or re-run) the audit against the avatar + Signature. */
  onCheckAsset?: () => void;
  /** Record the on-brand / off-brand verdict (record_assessment). */
  onRecordVerdict?: (audit: AuditResult, verdict: AssetVerdict) => void;
}

const IDEA_DIMENSIONS: ReadonlyArray<{ key: keyof AuditResult['scores']; label: string }> = [
  { key: 'i', label: 'Identify' },
  { key: 'd', label: 'Discover' },
  { key: 'e', label: 'Execute' },
  { key: 'a', label: 'Analyse' },
];

const TABS: ReadonlyArray<{ id: AssetTabId; label: string; Icon: typeof ImageIcon }> = [
  { id: 'image-prompt', label: 'Prompt', Icon: ImageIcon },
  { id: 'design-brief', label: 'Brief', Icon: Sparkles },
  { id: 'check-asset', label: 'Check', Icon: ShieldCheck },
];

export function AssetDetailTabs({
  asset,
  grounded = [],
  imagePrompt = null,
  imagePromptLoading = false,
  imagePromptError = null,
  onGenerateImagePrompt,
  brief = null,
  briefLoading = false,
  briefError = null,
  onGenerateBrief,
  onConfirmClaim,
  onExportBrief,
  audit,
  auditLoading = false,
  auditError = null,
  onCheckAsset,
  onRecordVerdict,
}: AssetDetailTabsProps): JSX.Element {
  const [tab, setTab] = useState<AssetTabId>('image-prompt');
  const resolvedAudit = audit ?? asset.audit;

  // Announce the first tab once on mount — one event per view.
  const firstView = useRef(false);
  useEffect(() => {
    if (firstView.current) return;
    firstView.current = true;
    emit(ASSET_DETAIL_EVENTS.TAB_VIEWED, { tab, asset_id: asset.assetId });
  }, [tab, asset.assetId]);

  function handleTabChange(next: AssetTabId): void {
    if (next === tab) return;
    setTab(next);
    emit(ASSET_DETAIL_EVENTS.TAB_VIEWED, { tab: next, asset_id: asset.assetId });
  }

  function handleCheck(): void {
    emit(ASSET_DETAIL_EVENTS.CHECK_RUN, { asset_id: asset.assetId });
    onCheckAsset?.();
  }

  function handleVerdict(verdict: AssetVerdict): void {
    if (!resolvedAudit) return;
    emit(ASSET_DETAIL_EVENTS.VERDICT_RECORDED, { asset_id: asset.assetId, verdict });
    onRecordVerdict?.(resolvedAudit, verdict);
  }

  return (
    <div className="space-y-4" data-testid="v4-asset-detail-tabs">
      <header className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{asset.touchpointLabel}</p>
        <p className="text-xs text-muted-foreground">{asset.contextDescription}</p>
      </header>

      {/* Tablist — three even columns; short labels + icons keep it inside 375px. */}
      <div
        role="tablist"
        aria-label="Asset detail"
        className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`asset-tab-btn-${id}`}
              aria-selected={active}
              aria-controls={`asset-tab-panel-${id}`}
              onClick={() => handleTabChange(id)}
              data-testid={`asset-tab-${id}`}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors ${
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'image-prompt' && (
        <div
          role="tabpanel"
          id="asset-tab-panel-image-prompt"
          aria-labelledby="asset-tab-btn-image-prompt"
          className="space-y-3"
        >
          <ImagePromptTab
            prompt={imagePrompt}
            isLoading={imagePromptLoading}
            error={imagePromptError}
            grounded={grounded}
            onGenerate={onGenerateImagePrompt}
          />
        </div>
      )}

      {tab === 'design-brief' && (
        <div
          role="tabpanel"
          id="asset-tab-panel-design-brief"
          aria-labelledby="asset-tab-btn-design-brief"
          className="space-y-3"
        >
          {brief && <GroundedStrip fields={grounded} />}
          <MoveBriefClaimGate
            brief={brief}
            claims={brief?.claimGate ?? []}
            onConfirmClaim={onConfirmClaim ?? (() => undefined)}
            onExport={onExportBrief ?? (() => undefined)}
            isLoading={briefLoading}
            error={briefError}
            onRetry={onGenerateBrief}
          />
        </div>
      )}

      {tab === 'check-asset' && (
        <div
          role="tabpanel"
          id="asset-tab-panel-check-asset"
          aria-labelledby="asset-tab-btn-check-asset"
        >
          <CheckAssetTab
            audit={resolvedAudit}
            signatureVersion={asset.signatureVersion}
            isLoading={auditLoading}
            error={auditError}
            onCheck={handleCheck}
            onRecordVerdict={handleVerdict}
          />
        </div>
      )}
    </div>
  );
}

// ── image-prompt tab ───────────────────────────────────────────────────────────

function ImagePromptTab({
  prompt,
  isLoading,
  error,
  grounded,
  onGenerate,
}: {
  prompt: string | null;
  isLoading: boolean;
  error: string | null;
  grounded: GroundedField[];
  onGenerate?: () => void;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  if (isLoading) {
    return (
      <Card data-testid="asset-image-prompt">
        <CardContent className="space-y-3 p-4" aria-busy="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <TabError
        testId="asset-image-prompt-error"
        title="Couldn't write the image prompt"
        message={error}
        onRetry={onGenerate}
      />
    );
  }

  if (!prompt) {
    // No prompt AND no generator wired → image generation isn't live yet. Show
    // an honest "coming soon" state, never an actionless blank.
    if (!onGenerate) {
      return (
        <Card data-testid="asset-image-prompt-coming">
          <CardContent className="flex flex-col items-start gap-3 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ImageIcon className="h-4 w-4 text-gold-warm" />
              Image prompts are coming
            </div>
            <p className="text-sm text-muted-foreground">
              Ready-to-paste image prompts arrive when image generation goes live. Your brief and
              brand check are ready to use now — switch to the Brief or Check tab.
            </p>
          </CardContent>
        </Card>
      );
    }
    return (
      <TabEmpty
        testId="asset-image-prompt-empty"
        Icon={ImageIcon}
        title="No image prompt yet"
        body="Generate a ready-to-paste image prompt for this asset, grounded in your avatar and Signature."
        cta="Generate image prompt"
        onCta={onGenerate}
      />
    );
  }

  return (
    <Card data-testid="asset-image-prompt">
      <CardContent className="space-y-3 p-4">
        <GroundedStrip fields={grounded} />
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs text-foreground">
          {prompt}
        </pre>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 gap-2"
            onClick={() => void copy()}
            data-testid="asset-image-prompt-copy"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied' : 'Copy prompt'}
          </Button>
          {onGenerate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-10 gap-2"
              onClick={onGenerate}
              data-testid="asset-image-prompt-regenerate"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── check-asset tab ────────────────────────────────────────────────────────────

function CheckAssetTab({
  audit,
  signatureVersion,
  isLoading,
  error,
  onCheck,
  onRecordVerdict,
}: {
  audit: AuditResult | null;
  signatureVersion: string | null;
  isLoading: boolean;
  error: string | null;
  onCheck: () => void;
  onRecordVerdict: (verdict: AssetVerdict) => void;
}): JSX.Element {
  if (isLoading) {
    return (
      <Card data-testid="asset-check">
        <CardContent className="space-y-3 p-4" aria-busy="true">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <TabError
        testId="asset-check-error"
        title="Couldn't check this asset"
        message={error}
        onRetry={onCheck}
      />
    );
  }

  if (!audit) {
    return (
      <TabEmpty
        testId="asset-check-empty"
        Icon={ShieldCheck}
        title="Not checked yet"
        body="Audit this asset against your avatar and Signature to see what's on-brand and what drifts — nothing is scored until you run the check."
        cta="Check asset"
        onCta={onCheck}
      />
    );
  }

  return (
    <Card data-testid="asset-check">
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {IDEA_DIMENSIONS.map(({ key, label }) => (
            <div
              key={key}
              className="rounded-md border border-border p-2 text-center"
              data-testid={`asset-check-score-${key}`}
            >
              <div className="text-lg font-semibold tabular-nums text-foreground">
                {audit.scores[key]}
              </div>
              <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">What the audit found</p>
          <p className="text-sm text-muted-foreground">{audit.rationale}</p>
        </div>

        <div className="space-y-1 rounded-md border border-gold-warm/30 bg-gold-light/20 p-3">
          <p className="text-xs font-medium text-foreground">On-strategy fix</p>
          <p className="text-sm text-muted-foreground">{audit.fix}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Checked against{' '}
          {signatureVersion ? `Signature ${signatureVersion}` : 'your current Signature'}
          {typeof audit.grounding?.fields_used === 'number'
            ? ` · ${audit.grounding.fields_used} strategy field${
                audit.grounding.fields_used === 1 ? '' : 's'
              } used`
            : ''}
          .
        </p>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Record your verdict</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="brand"
              size="sm"
              className="min-h-10 flex-1 gap-2"
              onClick={() => onRecordVerdict('on_brand')}
              data-testid="asset-check-verdict-on-brand"
            >
              <CheckCircle2 className="h-4 w-4" />
              On-brand
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 flex-1 gap-2"
              onClick={() => onRecordVerdict('off_brand')}
              data-testid="asset-check-verdict-off-brand"
            >
              <ShieldAlert className="h-4 w-4" />
              Needs work
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── shared tab states ──────────────────────────────────────────────────────────

function TabEmpty({
  testId,
  Icon,
  title,
  body,
  cta,
  onCta,
}: {
  testId: string;
  Icon: typeof ImageIcon;
  title: string;
  body: string;
  cta: string;
  onCta?: () => void;
}): JSX.Element {
  return (
    <Card data-testid={testId}>
      <CardContent className="flex flex-col items-start gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="h-4 w-4 text-gold-warm" />
          {title}
        </div>
        <p className="text-sm text-muted-foreground">{body}</p>
        {onCta && (
          <Button
            type="button"
            variant="brand"
            size="sm"
            className="min-h-10 gap-2"
            onClick={onCta}
            data-testid={`${testId}-cta`}
          >
            {cta}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function TabError({
  testId,
  title,
  message,
  onRetry,
}: {
  testId: string;
  title: string;
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <Card data-testid={testId}>
      <CardContent className="flex flex-col items-start gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertCircle className="h-4 w-4" />
          {title}
        </div>
        <p className="text-sm text-muted-foreground">
          The coach hit a snag and nothing was made up.{message ? ` (${message})` : ''}
        </p>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 gap-2"
            onClick={onRetry}
            data-testid={`${testId}-retry`}
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
