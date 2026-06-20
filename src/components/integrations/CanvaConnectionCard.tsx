/**
 * CanvaConnectionCard — connect / connected state for the Canva integration.
 *
 * Disconnected: shows an explainer + a "Connect Canva" button that kicks off
 * the OAuth flow. Connected: shows the linked account's display name, granted
 * scopes, and a "Disconnect" button. Presentational — all state lives in
 * `useCanvaConnection`, passed in by the page.
 */

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, CheckCircle2 } from 'lucide-react';
import type { CanvaStatus } from '@/services/canva/types';

export interface CanvaConnectionCardProps {
  status: CanvaStatus | undefined;
  isLoading: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

/** Render the granted scopes as individual badges. */
function ScopeBadges({ scopes }: { scopes: string }): JSX.Element | null {
  const list = scopes.split(/\s+/).filter(Boolean);
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Granted Canva permissions">
      {list.map((scope) => (
        <Badge key={scope} variant="secondary" className="text-xs font-mono">
          {scope}
        </Badge>
      ))}
    </div>
  );
}

export function CanvaConnectionCard({
  status,
  isLoading,
  isConnected,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect,
}: CanvaConnectionCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-secondary" aria-hidden="true" />
          <CardTitle className="text-xl">Canva</CardTitle>
          {isConnected && (
            <Badge variant="outline" className="ml-auto gap-1 text-green-700 border-green-300">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Connected
            </Badge>
          )}
        </div>
        <CardDescription>
          Connect your Canva account to browse your designs and bring them into the Brand Coach.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Checking connection…
          </div>
        ) : isConnected ? (
          <div className="space-y-3">
            {status?.displayName && (
              <p className="text-sm">
                Signed in as{' '}
                <span className="font-semibold">{status.displayName}</span>
              </p>
            )}
            {status?.scopes && <ScopeBadges scopes={status.scopes} />}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You haven&apos;t connected Canva yet. Connecting lets the Brand Coach reference your
            existing designs so you can keep brand visuals consistent.
          </p>
        )}
      </CardContent>

      <CardFooter>
        {isConnected ? (
          <Button
            variant="outline"
            onClick={onDisconnect}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Disconnecting…
              </>
            ) : (
              'Disconnect'
            )}
          </Button>
        ) : (
          <Button
            variant="coach"
            onClick={onConnect}
            disabled={isConnecting || isLoading}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Connecting…
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" aria-hidden="true" />
                Connect Canva
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
