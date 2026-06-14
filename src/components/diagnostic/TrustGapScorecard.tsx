/**
 * Trust Gap™ 4-Dimension Scorecard.
 *
 * Renders the overall trust score (/100) and the four IDEA pillars (each /25),
 * pairing every pillar with a plain-language Trevor-voice interpretation, naming
 * the primary gap, and routing "Let's go deeper" to the matching IDEA page. The
 * scorecard itself is deterministic (built from stored scores via buildTrustGap);
 * the interpretation is fetched from the diagnostic-interpretation edge function
 * and degrades gracefully if unavailable.
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Lightbulb,
  Star,
  Heart,
  Shield,
  Target,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  buildTrustGap,
  getTrustGapBand,
  TRUST_GAP_MAX_PER_DIMENSION,
  type TrustGapBand,
  type TrustGapDimension,
  type TrustGapDimensionResult,
  type TrustGapInputScores,
} from '@/lib/trustGap';
import {
  useTrustGapInterpretation,
  type TrustGapInterpretation,
} from '@/hooks/useTrustGapInterpretation';
import { buildBridgePath } from '@/lib/journeyBridge';

interface TrustGapScorecardProps {
  scores: TrustGapInputScores;
}

interface DimensionPresentation {
  icon: JSX.Element;
  gradient: string;
}

const DIMENSION_PRESENTATION: Record<TrustGapDimension, DimensionPresentation> = {
  insight: { icon: <Lightbulb className="w-6 h-6" />, gradient: 'from-yellow-500 to-orange-500' },
  distinctive: { icon: <Star className="w-6 h-6" />, gradient: 'from-green-500 to-emerald-500' },
  empathetic: { icon: <Heart className="w-6 h-6" />, gradient: 'from-pink-500 to-rose-500' },
  authentic: { icon: <Shield className="w-6 h-6" />, gradient: 'from-blue-500 to-indigo-500' },
};

const BAND_BADGE: Record<TrustGapBand, { label: string; className: string }> = {
  weak: { label: 'Trust gap', className: 'bg-red-100 text-red-700 border-red-200' },
  mixed: { label: 'Developing', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  strong: { label: 'Building trust', className: 'bg-green-100 text-green-700 border-green-200' },
};

const OVERALL_BAND_COPY: Record<TrustGapBand, string> = {
  weak: 'Your brand is leaking trust in several places. There is a lot of upside here.',
  mixed: 'Your brand builds trust in parts and leaks it in others. A clear path forward exists.',
  strong: 'Your brand builds trust well across the board. Now you protect and sharpen it.',
};

/** Loading / error / text body for a single interpretation slot. */
function InterpretationBody({
  text,
  isLoading,
  hasError,
  lines = 2,
}: {
  text?: string;
  isLoading: boolean;
  hasError: boolean;
  lines?: number;
}): JSX.Element {
  if (text) {
    return <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{text}</p>;
  }
  if (isLoading) {
    return (
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    );
  }
  if (hasError) {
    return (
      <p className="text-sm text-muted-foreground/70 italic">
        Personalised read unavailable right now.
      </p>
    );
  }
  return <></>;
}

function DimensionCard({
  dimension,
  interpretationText,
  isLoading,
  hasError,
}: {
  dimension: TrustGapDimensionResult;
  interpretationText?: string;
  isLoading: boolean;
  hasError: boolean;
}): JSX.Element {
  const presentation = DIMENSION_PRESENTATION[dimension.key];
  const badge = BAND_BADGE[dimension.band];
  const progressValue = (dimension.score / TRUST_GAP_MAX_PER_DIMENSION) * 100;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-12 h-12 shrink-0 bg-gradient-to-r ${presentation.gradient} rounded-lg flex items-center justify-center text-white`}
          >
            {presentation.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{dimension.label}</h3>
              <span className="text-2xl font-bold tabular-nums">
                {dimension.score}
                <span className="text-base font-medium text-muted-foreground">/{TRUST_GAP_MAX_PER_DIMENSION}</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{dimension.measures}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Progress
            value={progressValue}
            className="flex-1"
            aria-label={`${dimension.label} score ${dimension.score} out of ${TRUST_GAP_MAX_PER_DIMENSION}`}
          />
          <Badge variant="outline" className={`shrink-0 ${badge.className}`}>
            {badge.label}
          </Badge>
        </div>
        <InterpretationBody text={interpretationText} isLoading={isLoading} hasError={hasError} lines={3} />
      </CardContent>
    </Card>
  );
}

export function TrustGapScorecard({ scores }: TrustGapScorecardProps): JSX.Element {
  const navigate = useNavigate();
  const model = buildTrustGap(scores);
  const { interpretation, isLoading, error, retry } = useTrustGapInterpretation(scores);

  const interpretations: TrustGapInterpretation['interpretations'] | undefined = interpretation?.interpretations;
  const overallBand = getTrustGapBand(Math.round(model.overall / 4));
  const gap = model.primaryGapMeta;

  return (
    <div className="space-y-6">
      {/* Overall trust score */}
      <Card className="bg-gradient-hero text-primary-foreground border-0">
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Your Trust Gap™ Score</h2>
          <div className="text-6xl font-bold mb-2 tabular-nums">
            {model.overall}
            <span className="text-2xl font-medium text-primary-foreground/80">/100</span>
          </div>
          <Progress value={model.overall} className="my-4 bg-white/20" />
          <p className="text-primary-foreground/90 max-w-xl mx-auto">{OVERALL_BAND_COPY[overallBand]}</p>
        </CardContent>
      </Card>

      {/* Four pillars, each /25, each with its interpretation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {model.dimensions.map((dimension) => (
          <DimensionCard
            key={dimension.key}
            dimension={dimension}
            interpretationText={interpretations?.[dimension.key]}
            isLoading={isLoading}
            hasError={!!error}
          />
        ))}
      </div>

      {/* Primary gap — the bridge from score to next move */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-primary">
            <Target className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Your biggest Trust Gap</span>
          </div>
          <h2 className="text-2xl font-bold">{gap.label}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <InterpretationBody
            text={interpretation?.primaryGapSummary}
            isLoading={isLoading}
            hasError={!!error}
            lines={2}
          />

          {error && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={retry} className="h-7 px-2">
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Try again
              </Button>
            </div>
          )}

          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => navigate(buildBridgePath(gap.key))}
          >
            Let's go deeper on {gap.label}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
