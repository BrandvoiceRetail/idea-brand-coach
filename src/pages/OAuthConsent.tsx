/**
 * OAuth 2.1 consent screen (Supabase OAuth server, MCP authorization).
 *
 * Supabase's OAuth server delegates the user-facing consent step to this app-hosted
 * page (configured as the project's `authorization_url_path` = `/oauth/consent`). When
 * an MCP client (e.g. the Claude connector) hits `/auth/v1/oauth/authorize`, Supabase
 * 302s the user here with an `authorization_id`. We:
 *   1. require a signed-in Supabase session (bounce to /auth and return here),
 *   2. fetch the request details (which app, which scopes),
 *   3. on approve/deny, call Supabase's consent endpoint and follow the returned
 *      `redirect_url` back to the client with the authorization code.
 * The token exchange itself happens client↔Supabase directly — this page never sees it.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://ecdrxtbclxfpkknasmrw.supabase.co';
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZHJ4dGJjbHhmcGtrbmFzbXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5ODE5ODYsImV4cCI6MjA2OTU1Nzk4Nn0.yPlOSq4l4PMD9RlchTBeXs5EBmzggGQGp7A8B3qGAAk';

interface AuthorizationDetails {
  client?: { name?: string | null };
  scope?: string | null;
  user?: { email?: string | null };
}

const SCOPE_LABELS: Record<string, string> = {
  openid: 'Confirm your identity',
  profile: 'Read your basic profile',
  email: 'Read your email address',
  phone: 'Read your phone number',
};

export default function OAuthConsent(): JSX.Element {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const authorizationId = params.get('authorization_id');
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'error'>('loading');
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!authorizationId) {
        setErrorMsg('This authorization link is missing its request id.');
        setStatus('error');
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
        navigate(`/auth?redirect=${encodeURIComponent(back)}`, { replace: true });
        return;
      }
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/oauth/authorizations/${authorizationId}`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as AuthorizationDetails;
        if (!cancelled) {
          setDetails(data);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) {
          setErrorMsg('We could not load this authorization request. It may have expired — start the connection again.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authorizationId, navigate]);

  const decide = async (action: 'approve' | 'deny'): Promise<void> => {
    setStatus('submitting');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId ?? '')}`;
      navigate(`/auth?redirect=${encodeURIComponent(back)}`, { replace: true });
      return;
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/oauth/authorizations/${authorizationId}/consent`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { redirect_url?: string; msg?: string };
      if (!res.ok || !data.redirect_url) throw new Error(data.msg ?? 'consent failed');
      window.location.href = data.redirect_url;
    } catch {
      toast.error('Something went wrong saving your choice. Please try again.');
      setStatus('ready');
    }
  };

  const appName = details?.client?.name?.trim() || 'An application';
  const scopes = (details?.scope ?? 'openid').split(/\s+/).filter(Boolean);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authorize access</CardTitle>
          <CardDescription>
            {status === 'error'
              ? 'Authorization request'
              : `${appName} wants to connect to your IDEA Brand Coach account.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === 'loading' && <p className="text-sm text-muted-foreground">Loading authorization request…</p>}

          {status === 'error' && (
            <>
              <p className="text-sm text-destructive">{errorMsg}</p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
                Back to app
              </Button>
            </>
          )}

          {(status === 'ready' || status === 'submitting') && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium">This will allow it to:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {scopes.map((s) => (
                    <li key={s}>• {SCOPE_LABELS[s] ?? s}</li>
                  ))}
                </ul>
              </div>
              {details?.user?.email && (
                <p className="text-xs text-muted-foreground">Signed in as {details.user.email}</p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={status === 'submitting'}
                  onClick={() => decide('deny')}
                >
                  Deny
                </Button>
                <Button className="flex-1" disabled={status === 'submitting'} onClick={() => decide('approve')}>
                  {status === 'submitting' ? 'Authorizing…' : 'Approve'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
