/**
 * DiagnosticLeadCapture
 *
 * Inline card (not a modal) on the diagnostic results page that captures an
 * ANONYMOUS visitor's email so they can be sent their Trust Gap report. This is
 * the lead-magnet step of the free diagnostic funnel: a guest finishes the
 * on-screen scorecard and opts in here to receive the report by email.
 *
 * It collects email (required), name (optional), and a REQUIRED GDPR-style
 * consent checkbox, then POSTs to the `submit-diagnostic-lead` edge function with
 * the scorecard's scores (rescaled to /25 + overall /100, matching
 * useTrustGapInterpretation), the derived primary gap, the PostHog distinct id
 * (the funnel join key), and any utm_* parsed from the URL.
 *
 * Shown ONCE per page (the parent renders it only for guests, and it collapses to
 * a thank-you state after a successful submit, so it never nags). Authenticated
 * users never see it — they already have an account. The signup/booking CTAs on
 * the page coexist with this and become an upsell, not a replacement.
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Mail, User, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { getPostHogDistinctId } from '@/lib/posthogClient';
import { buildTrustGap, type TrustGapInputScores } from '@/lib/trustGap';

interface DiagnosticLeadCaptureProps {
  /** Raw stored scores (each dimension 0-100 + overall) for the on-screen scorecard. */
  scores: TrustGapInputScores;
  /** Optional answers map from the diagnostic, captured alongside the lead. */
  answers?: Record<string, string>;
}

/** Edge-function response shape: lead is captured iff `ok`, emailed iff `emailed`. */
interface LeadResponse {
  ok: boolean;
  emailed: boolean;
  error?: string;
}

type SubmitStatus = 'idle' | 'submitting' | 'done';

const CONSENT_COPY =
  'I agree to receive my Trust Gap report and occasional brand tips. Unsubscribe anytime.';

/** Pull utm_* params from the current URL querystring (e.g. utm_source). */
function parseUtmFromUrl(): Record<string, string> | undefined {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      if (key.toLowerCase().startsWith('utm_') && value) utm[key] = value;
    }
    return Object.keys(utm).length > 0 ? utm : undefined;
  } catch {
    return undefined;
  }
}

function isLeadResponse(data: unknown): data is LeadResponse {
  return !!data && typeof data === 'object' && typeof (data as LeadResponse).ok === 'boolean';
}

export function DiagnosticLeadCapture({ scores, answers }: DiagnosticLeadCaptureProps): JSX.Element {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>('idle');
  // Drives the thank-you copy: true when the report email was actually sent.
  const [emailedResult, setEmailedResult] = useState(false);

  // Rescale to the /25 + overall /100 contract the edge function expects, and
  // derive the primary gap deterministically (single source of truth: buildTrustGap).
  const { dimensionScores, overall, primaryGap } = useMemo(() => {
    const model = buildTrustGap(scores);
    return {
      dimensionScores: Object.fromEntries(model.dimensions.map((d) => [d.key, d.score])) as Record<
        string,
        number
      >,
      overall: model.overall,
      primaryGap: model.primaryGap,
    };
  }, [scores]);

  const handleSubmit = async (): Promise<void> => {
    if (!email.trim()) {
      toast.error('Please enter your email to receive your Trust Gap report.');
      return;
    }
    if (!consent) {
      toast.error('Please tick the consent box so we can send your report.');
      return;
    }

    setStatus('submitting');
    try {
      const { data, error } = await supabase.functions.invoke('submit-diagnostic-lead', {
        body: {
          email: email.trim(),
          name: name.trim() || undefined,
          consent: true,
          scores: { ...dimensionScores, overall },
          answers: answers && Object.keys(answers).length > 0 ? answers : undefined,
          primary_gap: primaryGap,
          posthog_distinct_id: getPostHogDistinctId(),
          utm: parseUtmFromUrl(),
        },
      });

      if (error || !isLeadResponse(data) || !data.ok) {
        const message = isLeadResponse(data) ? data.error : error?.message;
        console.error('[DiagnosticLeadCapture] submit failed:', message ?? 'unknown error');
        toast.error('We could not save your details right now. Please try again.');
        setStatus('idle');
        return;
      }

      setEmailedResult(data.emailed);
      setStatus('done');
    } catch (err: unknown) {
      console.error('[DiagnosticLeadCapture] unexpected error:', err);
      toast.error('We could not save your details right now. Please try again.');
      setStatus('idle');
    }
  };

  if (status === 'done') {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-primary" />
            <div>
              <h3 className="text-lg font-semibold mb-1">
                {emailedResult ? 'Check your inbox' : 'You are on the list'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {emailedResult
                  ? `Your Trust Gap report is on its way to ${email.trim()}.`
                  : "Saved — we'll email your report shortly."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isSubmitting = status === 'submitting';

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Get your Trust Gap report by email
        </CardTitle>
        <CardDescription>
          We'll send your full Trust Gap report, with your scores and your biggest opportunity, straight
          to your inbox.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lead-email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email address *
            </Label>
            <Input
              id="lead-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Name (optional)
            </Label>
            <Input
              id="lead-name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="lead-consent"
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
              disabled={isSubmitting}
              className="mt-0.5"
            />
            <Label htmlFor="lead-consent" className="text-sm font-normal leading-snug text-muted-foreground">
              {CONSENT_COPY}
            </Label>
          </div>

          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                Send my report
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
