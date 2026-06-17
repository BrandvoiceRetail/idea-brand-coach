/**
 * FigmaCallback — handles the OAuth redirect back from Figma.
 *
 * Reads ?code & ?state, verifies the CSRF state against sessionStorage, then
 * exchanges the code via the authenticated figma-oauth-exchange function and
 * returns the user to the Integrations page.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FigmaIntegrationService } from '@/services/FigmaIntegrationService';
import { FIGMA_STATE_KEY, figmaRedirectUri } from '@/hooks/useFigmaIntegration';
import { ROUTES } from '@/config/routes';

type Phase = 'working' | 'done' | 'error';

export default function FigmaCallback(): JSX.Element {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('working');
  const [message, setMessage] = useState<string>('Connecting your Figma account…');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard against React StrictMode double-invoke
    ran.current = true;

    const run = async (): Promise<void> => {
      const code = params.get('code');
      const returnedState = params.get('state');
      const figmaError = params.get('error');

      if (figmaError) {
        setPhase('error');
        setMessage('Figma connection was cancelled.');
        return;
      }
      if (!code || !returnedState) {
        setPhase('error');
        setMessage('Missing authorization details from Figma.');
        return;
      }

      const storedState = sessionStorage.getItem(FIGMA_STATE_KEY);
      sessionStorage.removeItem(FIGMA_STATE_KEY);
      if (storedState && storedState !== returnedState) {
        setPhase('error');
        setMessage('Connection state mismatch. Please try connecting again.');
        return;
      }

      try {
        await FigmaIntegrationService.completeConnect({
          code,
          state: returnedState,
          redirectUri: figmaRedirectUri(),
        });
        setPhase('done');
        setMessage('Figma connected! Redirecting…');
        toast.success('Figma connected');
        setTimeout(() => navigate(ROUTES.INTEGRATIONS, { replace: true }), 1200);
      } catch (e) {
        setPhase('error');
        setMessage(e instanceof Error ? e.message : 'Could not complete the Figma connection.');
      }
    };

    void run();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center space-y-4">
        {phase === 'working' && <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />}
        {phase === 'done' && <CheckCircle2 className="h-8 w-8 mx-auto text-green-600" />}
        {phase === 'error' && <AlertCircle className="h-8 w-8 mx-auto text-destructive" />}
        <p className="text-sm text-muted-foreground">{message}</p>
        {phase === 'error' && (
          <Button variant="outline" onClick={() => navigate(ROUTES.INTEGRATIONS, { replace: true })}>
            Back to Integrations
          </Button>
        )}
      </div>
    </div>
  );
}
