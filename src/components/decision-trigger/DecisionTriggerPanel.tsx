/**
 * DecisionTriggerPanel
 *
 * Renders the seller's dominant Decision Trigger™ after the Trust Gap scorecard:
 * the named trigger + brand anchor, 2-3 verbatim review phrases as evidence, and
 * one placement instruction. A tap-to-expand "Why this trigger" carries the only
 * derivation explanation, in plain language.
 *
 * It must "feel like a finding, not a calculation" — so it surfaces NO confidence
 * score, NO per-type colour-badge system, and NO CAPTURE weighting table (brief
 * §3.4). It needs an authenticated caller and an imported listing; without
 * evidence it shows a short locked teaser instead of a derivation.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Crosshair, Quote, MapPin, ChevronDown, Lock } from 'lucide-react';
import type { TrustGapInputScores } from '@/lib/trustGap';
import type { TrustGapEvidence } from '@/services/interfaces/IProductDataService';
import { useDecisionTrigger } from './useDecisionTrigger';
import type { DecisionTriggerResult } from './types';

interface DecisionTriggerPanelProps {
  scores: TrustGapInputScores;
  evidence: TrustGapEvidence | undefined;
  evidenceKey: string | undefined;
  sessionId: string;
  isAuthenticated: boolean;
  /**
   * Pre-computed trigger to render directly. When supplied, the panel skips its
   * own derivation (no `identify-decision-trigger` call) and renders this result
   * verbatim — used by the forensic flow, where the trigger comes back inside the
   * `run-forensic-analysis` response. When omitted, the panel derives the trigger
   * itself via {@link useDecisionTrigger} (the diagnostic-results flow).
   */
  result?: DecisionTriggerResult;
}

function PanelShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 shrink-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center text-white">
            <Crosshair className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Your Decision Trigger™</h3>
            </div>
            <p className="text-sm text-muted-foreground">The one reason your customer acts, in their own words.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** The found-trigger render (label + anchor / verbatim evidence / placement / why). */
function TriggerResult({ trigger }: { trigger: DecisionTriggerResult }): React.JSX.Element {
  const [whyOpen, setWhyOpen] = useState(false);
  return (
    <div className="space-y-5">
      {/* 1 — Label + brand anchor */}
      <div>
        <Badge variant="secondary" className="mb-2">Decision Trigger</Badge>
        <h4 className="text-2xl font-bold tracking-tight">{trigger.dominantType}</h4>
        <p className="text-sm text-muted-foreground mt-1">{trigger.brandAnchor}</p>
      </div>

      {/* 2 — Evidence (verbatim) */}
      {trigger.evidencePhrases.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Quote className="w-3.5 h-3.5" /> Evidence from your reviews
          </div>
          <ul className="space-y-2">
            {trigger.evidencePhrases.map((phrase, i) => (
              <li key={i} className="border-l-2 border-primary/40 pl-3 text-sm italic text-foreground/90">
                &ldquo;{phrase}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3 — Placement instruction */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" /> Where to deploy it
        </div>
        <p className="text-sm leading-relaxed">{trigger.placementInstruction}</p>
      </div>

      {/* Secondary expansion — the only place derivation is explained, in plain words */}
      {trigger.whyThisTrigger && (
        <Collapsible open={whyOpen} onOpenChange={setWhyOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="px-0 text-muted-foreground hover:text-foreground">
              Why this trigger
              <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${whyOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-sm text-muted-foreground leading-relaxed pt-2">{trigger.whyThisTrigger}</p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function DecisionTriggerPanel({
  scores,
  evidence,
  evidenceKey,
  sessionId,
  isAuthenticated,
  result,
}: DecisionTriggerPanelProps): React.JSX.Element | null {
  const hasEvidence = !!evidence && (evidence.listings.length > 0 || evidence.topReviews.length > 0);
  // A pre-computed result (forensic flow) bypasses derivation entirely.
  const enabled = !result && isAuthenticated && hasEvidence;
  const { trigger, isLoading, error, retry } = useDecisionTrigger(scores, evidence, evidenceKey, sessionId, enabled);

  // Pre-computed result wins: render it directly without ever calling the deriver.
  if (result) {
    return (
      <PanelShell>
        <TriggerResult trigger={result} />
      </PanelShell>
    );
  }

  // Locked teaser — no evidence yet (or guest). The ProductImportCta below unlocks it.
  if (!enabled) {
    return (
      <PanelShell>
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            {isAuthenticated
              ? 'Import your Amazon listing below and we will reveal the exact psychological trigger your customers act on, drawn from their real reviews.'
              : 'Create an account and import your listing to reveal the exact psychological trigger your customers act on.'}
          </p>
        </div>
      </PanelShell>
    );
  }

  if (isLoading) {
    return (
      <PanelShell>
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </PanelShell>
    );
  }

  if (error || !trigger) {
    return (
      <PanelShell>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{error ?? 'We could not reveal your Decision Trigger right now.'}</p>
          <Button variant="outline" size="sm" onClick={retry}>Try again</Button>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <TriggerResult trigger={trigger} />
    </PanelShell>
  );
}
