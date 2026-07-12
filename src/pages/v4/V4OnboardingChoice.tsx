/**
 * V4OnboardingChoice — the POST-SIGNUP fork.
 *
 * Two ways to bring a brand in, deliberately UNEQUAL in prominence:
 *  - PRIMARY (recommended): onboard via the Brand Coach connector in
 *    Claude/ChatGPT — fast, because the user's AI assistant already knows their
 *    brand + analytics. A strong gold CTA → the ConnectorSetup screen.
 *  - SECONDARY: a quiet text link → the in-app megaprompt path (V4Onboarding)
 *    for users who'd rather not use Claude/ChatGPT.
 *
 * Content-only: rendered inside V4Layout (v23 dark chrome) by the route table.
 * No data reads here — it's a router fork, so no loading/error/empty states are
 * applicable beyond the two static choices.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, MessageSquare, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { V4_ROUTES, markV4OnboardingSeen } from '@/config/v4';
import { captureAlphaEvent } from '@/lib/posthogClient';

/**
 * Choice-screen funnel events. A typed subset of the canonical AlphaEventName
 * union (registered in posthogClient) — passed straight to captureAlphaEvent so
 * the compiler still guards the names; no casts.
 */
type V4ChoiceEvent =
  | 'v4_onboard_choice_viewed'
  | 'v4_onboard_choice_connector'
  | 'v4_onboard_choice_in_app';

function emit(name: V4ChoiceEvent): void {
  captureAlphaEvent(name);
}

export default function V4OnboardingChoice(): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    emit('v4_onboard_choice_viewed');
  }, []);

  const goConnector = (): void => {
    // The user has made their first-run choice — don't re-show CHOICE on the
    // next visit to `/` (VersionGate then sends them straight to /v4).
    markV4OnboardingSeen();
    emit('v4_onboard_choice_connector');
    navigate(V4_ROUTES.CONNECTOR);
  };

  const goInApp = (): void => {
    markV4OnboardingSeen();
    emit('v4_onboard_choice_in_app');
    navigate(V4_ROUTES.ROOT);
  };

  return (
    // Vertically centre the short onboarding content on desktop so it isn't a card
    // marooned at the top of a tall empty surface; mobile keeps natural top flow.
    <div className="space-y-6 md:flex md:min-h-[68vh] md:flex-col md:justify-center">
      <header className="space-y-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-gold-light px-3 py-1 text-xs font-semibold text-gold-warm">
          <Sparkles className="h-3.5 w-3.5" />
          You're in
        </span>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Let's bring your brand in
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          The fastest way is to let your AI assistant do the heavy lifting — it
          already knows your brand and your numbers. Pick how you'd like to
          start.
        </p>
      </header>

      {/* PRIMARY — recommended connector path. Gold ring + brand CTA make it the
          obvious default. */}
      <Card
        className="border-2 border-gold-warm/60 shadow-brand"
        data-testid="choice-connector-card"
      >
        <CardHeader className="space-y-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gold-warm px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
            <Zap className="h-3.5 w-3.5" />
            Recommended
          </span>
          <CardTitle className="flex items-center gap-2 text-xl">
            <MessageSquare className="h-5 w-5 text-gold-warm" />
            Onboard with Claude or ChatGPT
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-muted-foreground">
            Add the IDEA Brand Coach connector to the AI assistant you already
            use. It reads what your Claude or ChatGPT already knows about your
            products, customers, and analytics, then brings it straight into your
            funnel here — no re-typing, no homework.
          </p>
          <Button
            type="button"
            variant="brand"
            size="lg"
            onClick={goConnector}
            className="w-full gap-2 sm:w-auto"
            data-testid="choice-connector-cta"
          >
            Set up the connector
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* SECONDARY — deliberately quiet text link, not a card or button. */}
      <div className="pt-1 text-center sm:text-left">
        <button
          type="button"
          onClick={goInApp}
          className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          data-testid="choice-in-app-link"
        >
          Prefer to set it up in the app instead?
        </button>
      </div>
    </div>
  );
}
