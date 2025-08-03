import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Monitor, Smartphone } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface DesktopOnlyFeatureProps {
  children: React.ReactNode;
  featureName: string;
  mobileMessage?: string;
  mobileAlternative?: React.ReactNode;
  showIcon?: boolean;
}

export const DesktopOnlyFeature: React.FC<DesktopOnlyFeatureProps> = ({
  children,
  featureName,
  mobileMessage,
  mobileAlternative,
  showIcon = true
}) => {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardContent className="pt-6">
        <div className="flex gap-3 items-start">
          {showIcon && (
            <div className="flex gap-2 mt-1 flex-shrink-0">
              <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <Monitor className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {featureName} Available on Desktop
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-200">
              {mobileMessage || `${featureName} is optimized for desktop use. Please visit this page on your computer for the full experience.`}
            </p>
            {mobileAlternative && (
              <div className="mt-3">
                {mobileAlternative}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};