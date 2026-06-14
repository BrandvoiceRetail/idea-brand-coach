/**
 * Journey Bridge (F-059).
 *
 * The narrative hand-off between the Trust Gap™ scorecard and the Layer 1 coach:
 * "here's your gap → now let's build the Signature that closes it." It also acts
 * as the intentional sign-up gate (arch.md D3) — guests are invited to create a
 * free account to build their Signature, rather than being abruptly bounced to
 * /auth. The primary gap arrives via `?gap=` and is carried onward to /v2/coach.
 */

import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Sparkles, Target } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { V1_ROUTES } from '@/config/routes';
import { TRUST_GAP_DIMENSION_META } from '@/lib/trustGap';
import { parseGapParam, buildDeepDiveDestination } from '@/lib/journeyBridge';

export default function JourneyBridge(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const gap = parseGapParam(searchParams.get('gap'));
  const meta = gap ? TRUST_GAP_DIMENSION_META[gap] : null;
  const isAuthenticated = !!user;

  const heading = meta ? `Let's close your ${meta.label} gap` : "Let's build your Signature";
  const ctaLabel = isAuthenticated ? 'Build my Signature' : 'Create your free account to build your Signature';

  const handleContinue = (): void => {
    navigate(buildDeepDiveDestination(gap, isAuthenticated));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-gradient-hero text-primary-foreground border-0">
            <CardContent className="p-8 sm:p-10 text-center">
              <div className="flex justify-center mb-4">
                <Badge variant="outline" className="px-3 py-1 border-white/30 text-primary-foreground">
                  <Target className="w-4 h-4 mr-2" />
                  Your next step
                </Badge>
              </div>

              <h1 className="text-3xl font-bold mb-4">{heading}</h1>

              <p className="text-primary-foreground/90 leading-relaxed mb-2">
                {meta
                  ? `Your scorecard shows ${meta.label} is where your brand leaks the most trust. ${meta.measures}`
                  : 'Your scorecard is the start. The recognition moment is your Signature.'}
              </p>
              <p className="text-primary-foreground/90 leading-relaxed mb-8">
                The fastest way to close it is to build your <strong>Signature</strong> — the one true
                thing your customers are really buying. Let's do that now.
              </p>

              <Button size="lg" variant="secondary" className="w-full sm:w-auto" onClick={handleContinue}>
                <Sparkles className="w-4 h-4 mr-2" />
                {ctaLabel}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              {!isAuthenticated && (
                <p className="text-xs text-primary-foreground/70 mt-4">
                  Free account. We'll bring your {meta ? meta.label : 'Trust Gap'} result with you.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="text-center mt-6">
            <Button
              variant="ghost"
              onClick={() => navigate(V1_ROUTES.DIAGNOSTIC_RESULTS)}
              className="text-muted-foreground"
            >
              ← Back to my scorecard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
