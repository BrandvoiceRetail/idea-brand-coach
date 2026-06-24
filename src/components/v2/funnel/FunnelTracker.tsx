/**
 * FunnelTracker — the Brand Funnel Tracker dashboard (route /v2/funnel).
 * Four tabs: Funnel Map, What Needs Work, In Progress, Testing & Lift — wired to
 * SupabaseBrandFunnelService via useFunnelTracker. Style follows the brand's editorial
 * palette (gold + IDEA dimension colours).
 *
 * Competitor-Agents (behind COMPETITOR_AGENTS): each needs-work funnel piece mounts a
 * TouchpointCompetitorAgentPanel scoped to that asset's touchpoint; the "What Needs
 * Work" tab carries a CompetitorGapsAggregate rollup; the "Testing & Lift" tab folds in
 * the competitor-informed lift surface (TestingLiftTab); and a fifth "Defense" tab hosts
 * the brand-defense alert inbox with an unread badge on its trigger.
 */
import { useEffect, useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { useFunnelTracker } from '@/hooks/useFunnelTracker';
import { useAuth } from '@/hooks/useAuth';
import { useBrandDefenseAlerts } from '@/hooks/useBrandDefenseAlerts';
import { getTouchpoint, type ApplicabilityTag } from '@/config/touchpointTaxonomy';
import { isCompetitorAgentsEnabled } from '@/config/features';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssetUploadDialog } from './AssetUploadDialog';
import { FixDialog } from './FixDialog';
import { TouchpointCompetitorAgentPanel } from './TouchpointCompetitorAgentPanel';
import { CompetitorGapsAggregate } from './CompetitorGapsAggregate';
import { TestingLiftTab } from './TestingLiftTab';
import { BrandDefenseAlertsPanel } from './BrandDefenseAlertsPanel';
import { pieceFromAsset, touchpointModality, type FunnelPiece } from './funnelPiece';
import type { SupabaseBrandFunnelService } from '@/services/SupabaseBrandFunnelService';
import type { AssetStatus, BrandAsset, CoverageCell } from '@/services/interfaces/IBrandFunnelService';

export type { FunnelPiece } from './funnelPiece';

const STATUS_COLOR: Record<AssetStatus, string> = {
  aligned: '#54B657', stale: '#D89B0D', misaligned: '#F08A00', missing: '#B8B2A8', pending: '#8A847D', failed: '#c4571f',
};
const DIM = [
  { key: 'i' as const, label: 'I', color: '#D89B0D' },
  { key: 'd' as const, label: 'D', color: '#54B657' },
  { key: 'e' as const, label: 'E', color: '#3BA0D1' },
  { key: 'a' as const, label: 'A', color: '#F08A00' },
];

function StatusBadge({ status }: { status: AssetStatus }): JSX.Element {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: `${STATUS_COLOR[status]}22`, color: STATUS_COLOR[status] }}
    >
      {status}
    </span>
  );
}

function DimensionBars({ asset }: { asset: BrandAsset }): JSX.Element | null {
  const scores = asset.audit_result?.scores;
  if (!scores) return null;
  return (
    <div className="flex flex-col gap-1">
      {DIM.map((d) => (
        <div key={d.key} className="grid grid-cols-[14px_1fr_28px] items-center gap-2">
          <span className="text-[10px] font-bold text-muted-foreground">{d.label}</span>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${scores[d.key]}%`, backgroundColor: d.color }} />
          </div>
          <span className="text-[10px] text-muted-foreground text-right">{scores[d.key]}</span>
        </div>
      ))}
    </div>
  );
}

function RecordResult({ testId, baseline, service, onDone }: {
  testId: string; baseline: number; service: SupabaseBrandFunnelService; onDone: () => void;
}): JSX.Element {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (): Promise<void> => {
    setSaving(true);
    const { error } = await service.closeTest(testId, Number(value));
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Result recorded');
    onDone();
  };
  return (
    <div className="mt-3 flex items-center gap-2">
      <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder={`result (baseline ${baseline})`} className="h-8" />
      <Button size="sm" variant="secondary" disabled={value.trim() === '' || saving} onClick={() => void submit()}>Record</Button>
    </div>
  );
}

const ALL_CHANNEL_TAGS: ApplicabilityTag[] = [
  'amazon', 'shopify', 'dtc_site', 'email', 'organic_social', 'paid_social', 'packaging', 'founder', 'support', 'loyalty',
];

function ChannelTags({ tags, onChange }: { tags: ApplicabilityTag[]; onChange: (t: ApplicabilityTag[]) => void }): JSX.Element {
  const toggle = (t: ApplicabilityTag): void =>
    onChange(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Channels:</span>
      {ALL_CHANNEL_TAGS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => toggle(t)}
          className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
            tags.includes(t) ? 'border-transparent bg-secondary text-secondary-foreground' : 'border-input text-muted-foreground hover:text-foreground'
          }`}
        >
          {t.replace('_', ' ')}
        </button>
      ))}
    </div>
  );
}

/**
 * The "Defense" tab trigger (Competitor-Agents P6) with an unread-alert badge.
 * Owns its own cheap unread-count fetch so the badge reflects new alerts without
 * loading the full inbox. Rendered only when COMPETITOR_AGENTS is enabled.
 */
function DefenseTabTrigger({ avatarId }: { avatarId?: string }): JSX.Element {
  const { unreadCount, refreshUnreadCount } = useBrandDefenseAlerts();

  useEffect(() => {
    if (avatarId) void refreshUnreadCount(avatarId);
  }, [avatarId, refreshUnreadCount]);

  return (
    <TabsTrigger value="defense" className="gap-1.5">
      Defense
      {unreadCount > 0 && (
        <Badge variant="destructive" className="h-5 min-w-5 px-1" aria-label={`${unreadCount} unread alerts`}>
          {unreadCount}
        </Badge>
      )}
    </TabsTrigger>
  );
}

export function FunnelTracker(): JSX.Element {
  const { user } = useAuth();
  const { selectedAvatarId, currentAvatar } = useAvatarContext();
  const { coverage, assets, tests, avatarFieldCount, loading, refresh, auditAsset, reauditAll, brandTags, setBrandTags, service } = useFunnelTracker(selectedAvatarId);
  const competitorEnabled = isCompetitorAgentsEnabled();

  // Gate on the user too, not just the avatar: a signed-out visitor can carry a
  // stale selectedAvatarId in localStorage, which would otherwise render the full
  // dashboard and fire authed queries instead of the sign-in CTA.
  if (!user || !selectedAvatarId) {
    return (
      <div className="mx-auto max-w-3xl p-10 text-center">
        <p className="text-muted-foreground">Map your funnel against a customer avatar — upload your touchpoints and the coach audits each against your avatar + Signature.</p>
        {user ? (
          <Button asChild variant="coach" className="mt-4"><Link to="/v2/coach">Create an avatar</Link></Button>
        ) : (
          // Logged-out visitors land here with no global nav — give them an explicit auth entry.
          <Button asChild variant="coach" className="mt-4"><Link to="/auth?redirect=%2Fv2%2Ffunnel">Sign in or create an account</Link></Button>
        )}
      </div>
    );
  }

  const needsWork = assets
    .filter((a) => a.status === 'misaligned' || a.status === 'stale')
    .sort((x, y) => (x.overall_score ?? 0) - (y.overall_score ?? 0));
  const inProgress = assets.filter((a) => a.status === 'pending' || a.status === 'failed');
  const staleCount = coverage?.counts.stale ?? 0;
  const avatarThin = avatarFieldCount > 0 && avatarFieldCount < 5;
  const labelFor = (a: BrandAsset): string => getTouchpoint(a.touchpoint_id)?.label ?? a.touchpoint_id;
  // Competitor-Agents: the needs-work assets are the funnel pieces that get their
  // own per-touchpoint competitor agent + the Tab-2 aggregate rollup.
  const competitorPieces: FunnelPiece[] = competitorEnabled ? needsWork.map(pieceFromAsset) : [];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Brand Funnel · {currentAvatar?.name ?? 'avatar'}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Your funnel, mapped</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void reauditAll()} disabled={loading || assets.length === 0}>
            {loading ? 'Working…' : 'Re-audit all'}
          </Button>
          <AssetUploadDialog avatarId={selectedAvatarId} onUploaded={() => void refresh()} />
        </div>
      </div>

      <ChannelTags tags={brandTags} onChange={setBrandTags} />

      {avatarThin && (
        <div className="mt-3 rounded-md border border-[#D89B0D] bg-[#FBF1D6] px-4 py-2.5 text-sm text-[#7a5a07]">
          Your avatar has only {avatarFieldCount} strategy field{avatarFieldCount === 1 ? '' : 's'} filled in — audits will be generic.{' '}
          <Link to="/v2/coach" className="font-semibold underline">Finish your avatar</Link> for verdicts grounded in your brand.
        </div>
      )}
      {staleCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#D89B0D] bg-[#FBF1D6] px-4 py-2.5 text-sm text-[#7a5a07]">
          <span>{staleCount} touchpoint{staleCount === 1 ? '' : 's'} drifted since your Signature changed.</span>
          <Button size="sm" variant="coach" onClick={() => void reauditAll()} disabled={loading}>Re-audit all</Button>
        </div>
      )}
      <div className="mb-4" />

      <Tabs defaultValue="map">
        <TabsList>
          <TabsTrigger value="map">Funnel Map</TabsTrigger>
          <TabsTrigger value="work">What Needs Work ({needsWork.length})</TabsTrigger>
          <TabsTrigger value="prog">In Progress ({inProgress.length})</TabsTrigger>
          <TabsTrigger value="test">Testing &amp; Lift ({tests.length})</TabsTrigger>
          {competitorEnabled && <DefenseTabTrigger avatarId={selectedAvatarId} />}
        </TabsList>

        {/* ---- Funnel Map ---- */}
        <TabsContent value="map" className="mt-5">
          {loading && !coverage && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => <Card key={i} className="h-20 animate-pulse bg-muted/50" />)}
            </div>
          )}
          {coverage && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Card className="p-4"><div className="text-2xl font-bold">{assets.length}</div><div className="text-xs text-muted-foreground">Tracked</div></Card>
                <Card className="p-4"><div className="text-2xl font-bold" style={{ color: STATUS_COLOR.aligned }}>{coverage.counts.aligned}</div><div className="text-xs text-muted-foreground">Aligned</div></Card>
                <Card className="p-4"><div className="text-2xl font-bold" style={{ color: STATUS_COLOR.stale }}>{coverage.counts.stale}</div><div className="text-xs text-muted-foreground">Stale</div></Card>
                <Card className="p-4"><div className="text-2xl font-bold" style={{ color: STATUS_COLOR.misaligned }}>{coverage.counts.misaligned}</div><div className="text-xs text-muted-foreground">Misaligned</div></Card>
                <Card className="p-4"><div className="text-2xl font-bold" style={{ color: STATUS_COLOR.missing }}>{coverage.counts.missing}</div><div className="text-xs text-muted-foreground">Missing</div></Card>
              </div>

              <Card className="mb-5 p-5">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">On-brand coverage</span>
                  <span className="text-lg font-bold">{coverage.coveragePct}% <span className="text-xs font-normal text-muted-foreground">· target {coverage.targetPct}%</span></span>
                </div>
                <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${coverage.coveragePct}%`, background: 'linear-gradient(90deg,#D89B0D,#F08A00)' }} />
                  <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-foreground" style={{ left: `${coverage.targetPct}%` }} />
                </div>
              </Card>

              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                {coverage.byStage.map(({ stage, label, cells }) => (
                  <div key={stage}>
                    <div className="px-1 pb-2 text-sm font-bold">{label}</div>
                    <div className="flex flex-col gap-2">
                      {cells.length === 0 && <div className="text-xs text-muted-foreground px-1">—</div>}
                      {cells.map((cell: CoverageCell) => (
                        <Card
                          key={cell.touchpointId}
                          className="p-3"
                          style={{ borderLeft: `3px solid ${STATUS_COLOR[cell.status]}`, borderStyle: cell.status === 'missing' ? 'dashed' : undefined }}
                        >
                          <div className="text-[13px] font-semibold leading-tight">{cell.label}</div>
                          <div className="mt-2 flex items-center justify-between">
                            <StatusBadge status={cell.status} />
                            <span className="text-xs text-muted-foreground tabular-nums">{cell.overallScore ?? '—'}</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ---- What Needs Work ---- */}
        <TabsContent value="work" className="mt-5">
          {/* Competitor-Agents: aggregate competitor-gap rollup across the needs-work funnel pieces. */}
          {competitorEnabled && competitorPieces.length > 0 && (
            <div className="mb-5">
              <CompetitorGapsAggregate pieces={competitorPieces} />
            </div>
          )}
          <div className="flex flex-col gap-3">
            {needsWork.length === 0 && <p className="text-sm text-muted-foreground">Nothing flagged. Upload assets or your funnel is on-brand.</p>}
            {needsWork.map((a) => (
              <Card key={a.id} className="p-5 flex flex-col gap-4">
                <div className="grid gap-4 md:grid-cols-[1.4fr_1.3fr_auto] md:items-center">
                  <div>
                    <div className="text-[15px] font-bold">{labelFor(a)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{a.stage} · <StatusBadge status={a.status} /></div>
                    {a.previous_score != null && a.overall_score != null && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        was {a.previous_score} → now <span className="font-semibold" style={{ color: a.overall_score >= a.previous_score ? '#2f8f33' : '#c4571f' }}>{a.overall_score}</span>
                      </div>
                    )}
                    {a.audit_result?.fix && <div className="mt-2 text-xs text-foreground/80">{a.audit_result.fix}</div>}
                    {a.audit_result?.grounding && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        scored against {a.audit_result.grounding.fields_used} brand field{a.audit_result.grounding.fields_used === 1 ? '' : 's'}
                        {a.audit_result.grounding.fields_used < 3 ? ' — finish your avatar for a sharper verdict' : ''}
                      </div>
                    )}
                  </div>
                  <DimensionBars asset={a} />
                  <div className="flex flex-col gap-2">
                    <FixDialog asset={a} onDone={() => void refresh()} />
                    <Button variant="outline" size="sm" onClick={() => void auditAsset(a.id)}>Re-run audit</Button>
                  </div>
                </div>
                {/* Per-funnel-piece competitor agent, scoped to this asset's touchpoint. */}
                {competitorEnabled && (
                  <TouchpointCompetitorAgentPanel
                    assetId={a.id}
                    touchpointId={a.touchpoint_id}
                    touchpointLabel={labelFor(a)}
                    avatarId={selectedAvatarId}
                    modality={touchpointModality(a.touchpoint_id)}
                    currentCopy={a.content_text ?? undefined}
                    channel={getTouchpoint(a.touchpoint_id)?.appliesWhen[0]}
                    onDraftCountermeasure={() => void refresh()}
                  />
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ---- In Progress ---- */}
        <TabsContent value="prog" className="mt-5">
          <div className="flex flex-col gap-3">
            {inProgress.length === 0 && <p className="text-sm text-muted-foreground">Nothing awaiting audit.</p>}
            {inProgress.map((a) => (
              <Card key={a.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">{labelFor(a)}{a.status === 'failed' && <StatusBadge status="failed" />}</div>
                  <div className="text-xs text-muted-foreground">{a.context_description}</div>
                </div>
                <Button variant="secondary" onClick={() => void auditAsset(a.id)}>{a.status === 'failed' ? 'Retry' : 'Run audit'}</Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ---- Testing & Lift ---- */}
        <TabsContent value="test" className="mt-5">
          <div className="grid gap-3 md:grid-cols-2">
            {tests.length === 0 && <p className="text-sm text-muted-foreground">No tests yet. Tests are opened from a fix to measure before/after lift.</p>}
            {tests.map((t) => {
              const lift = (t.result_value ?? 0) - (t.baseline_value ?? 0);
              return (
                <Card key={t.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-bold">{t.hypothesis ?? 'Messaging test'}</div>
                    <Badge variant="outline">{t.status}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{t.metric_type ?? 'metric'}</span>
                    <span className="tabular-nums">{t.baseline_value ?? '—'} → {t.result_value ?? '—'}</span>
                    {t.result_value != null && (
                      <span className="font-bold" style={{ color: lift > 0 ? '#2f8f33' : lift < 0 ? '#c4571f' : '#8A847D' }}>
                        {lift > 0 ? '▲' : lift < 0 ? '▼' : '—'} {lift > 0 ? '+' : ''}{lift.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {t.status === 'running' && (
                    <RecordResult testId={t.id} baseline={t.baseline_value ?? 0} service={service} onDone={() => void refresh()} />
                  )}
                </Card>
              );
            })}
          </div>
          {/* Competitor-Agents: surface competitor-informed lift tests (brand_tests
              tagged competitor_insight_applied) alongside the base ROI tests. */}
          {competitorEnabled && (
            <div className="mt-6">
              <TestingLiftTab avatarId={selectedAvatarId} />
            </div>
          )}
        </TabsContent>

        {/* ---- Brand Defense (Competitor-Agents P6) ---- */}
        {competitorEnabled && (
          <TabsContent value="defense" className="mt-5">
            <BrandDefenseAlertsPanel avatarId={selectedAvatarId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
