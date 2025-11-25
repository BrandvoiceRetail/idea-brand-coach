/**
 * Coming Soon Component
 *
 * Displayed when a feature is not yet available in the current deployment phase.
 * Shows feature information, estimated release date, and optional CTA.
 */

import { Construction, Sparkles, Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface ComingSoonProps {
  /** Title of the feature */
  title: string;

  /** Description of the feature */
  description: string;

  /** Icon type to display */
  icon?: 'construction' | 'sparkles';

  /** Estimated release date/timeframe */
  estimatedRelease?: string;

  /** Show a CTA button */
  showCTA?: boolean;

  /** CTA button text */
  ctaText?: string;

  /** CTA button action */
  onCTAClick?: () => void;
}

export default function ComingSoon({
  title,
  description,
  icon = 'sparkles',
  estimatedRelease,
  showCTA = false,
  ctaText = 'Join Waitlist',
  onCTAClick,
}: ComingSoonProps): JSX.Element {
  const IconComponent = icon === 'construction' ? Construction : Sparkles;

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-6">
              <IconComponent className="w-12 h-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">{title}</CardTitle>
          <CardDescription className="text-lg">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {estimatedRelease && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-medium">
                Estimated Release: {estimatedRelease}
              </span>
            </div>
          )}

          {showCTA && onCTAClick && (
            <div className="flex justify-center pt-4">
              <Button onClick={onCTAClick} size="lg">
                {ctaText}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-sm text-center text-muted-foreground">
              We're working hard to bring you this feature. Check back soon!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
