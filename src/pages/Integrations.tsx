/**
 * Integrations — connect third-party tools to the Brand Coach.
 *
 * Currently composes the Canva Connect integration (connection card + designs
 * list). On mount it reads the post-OAuth `?canva=connected|error` return
 * params, fires the matching toast, then strips them from the URL so a refresh
 * doesn't re-announce. Authenticated route (wrapped in `<Layout>` in App.tsx).
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { CanvaConnectionCard } from '@/components/integrations/CanvaConnectionCard';
import { CanvaDesignsList } from '@/components/integrations/CanvaDesignsList';
import { useCanvaConnection } from '@/hooks/useCanvaConnection';
import {
  getCanvaReturnToast,
  parseCanvaReturn,
} from '@/services/canva/returnParams';
import { V1_ROUTES } from '@/config/routes';

export default function Integrations(): JSX.Element {
  const canva = useCanvaConnection();
  const { isConnected, loadImports } = canva;

  // Handle the post-OAuth return params exactly once on mount.
  const handledReturnRef = useRef(false);
  useEffect(() => {
    if (handledReturnRef.current) return;
    handledReturnRef.current = true;

    const result = parseCanvaReturn(window.location.search);
    const message = getCanvaReturnToast(result);
    if (!message) return;

    if (message.type === 'success') {
      toast.success(message.message);
    } else {
      toast.error(message.message);
    }

    // Strip the canva params so a refresh doesn't re-toast.
    const newUrl = `${window.location.pathname}${result.cleanedSearch}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, []);

  // Once connected, load the imported-designs list so cards reflect their state.
  useEffect(() => {
    if (isConnected) {
      void loadImports();
    }
  }, [isConnected, loadImports]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your favourite tools to bring brand assets into the Brand Coach.
        </p>
      </header>

      <CanvaConnectionCard
        status={canva.status}
        isLoading={canva.isLoading}
        isConnected={canva.isConnected}
        isConnecting={canva.isConnecting}
        isDisconnecting={canva.isDisconnecting}
        onConnect={() => void canva.connect(V1_ROUTES.INTEGRATIONS)}
        onDisconnect={() => void canva.disconnect()}
      />

      {canva.isConnected && (
        <CanvaDesignsList
          designs={canva.designs}
          imports={canva.imports}
          isLoadingDesigns={canva.isLoadingDesigns}
          designsContinuation={canva.designsContinuation}
          importingIds={canva.importingIds}
          onLoadDesigns={(continuation) => void canva.loadDesigns(continuation)}
          onImport={(design) => void canva.importDesign(design)}
          onRemove={(canvaDesignId) => void canva.removeImport(canvaDesignId)}
        />
      )}
    </div>
  );
}
