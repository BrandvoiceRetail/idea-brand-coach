import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Monitor, Smartphone } from "lucide-react";

interface DesktopOnlyFeatureProps {
  featureName: string;
  description?: string;
  mobileMessage?: string;
  mobileAlternative?: React.ReactNode;
  children: React.ReactNode;
}

export function DesktopOnlyFeature({ 
  featureName, 
  description, 
  mobileMessage,
  mobileAlternative, 
  children 
}: DesktopOnlyFeatureProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-secondary/10">
      <CardContent className="p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Monitor className="h-12 w-12 text-primary" />
            <Smartphone className="h-6 w-6 text-muted-foreground absolute -bottom-1 -right-1" />
          </div>
        </div>
        
        <h3 className="text-lg font-semibold text-primary mb-2">{featureName}</h3>
        {(description || mobileMessage) && (
          <p className="text-muted-foreground mb-4">{description || mobileMessage}</p>
        )}
        
        {mobileAlternative && (
          <div className="bg-secondary/20 rounded-lg p-3 mb-4">
            {typeof mobileAlternative === 'string' ? (
              <p className="text-sm text-muted-foreground">
                <strong>Mobile Alternative:</strong> {mobileAlternative}
              </p>
            ) : (
              mobileAlternative
            )}
          </div>
        )}
        
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Monitor className="h-4 w-4" />
          <span>Optimized for desktop experience</span>
        </div>
      </CardContent>
    </Card>
  );
}