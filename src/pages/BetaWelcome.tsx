/**
 * Alpha tester welcome (/beta) — the front door for invited testers.
 *
 * Static, framing-only page (T7): names Trevor Bradford and the IDEA Strategic
 * Brand Framework™, sets expectations (~15 minutes, bring your Amazon ASIN,
 * 7-day testing window), previews the path, and routes straight into the
 * diagnostic. No registration form — account creation happens naturally in-flow
 * when the tester imports their listing.
 *
 * Replaced the legacy beta-program registration page (save-beta-tester +
 * /beta-journey quick/comprehensive paths) on 2026-06-07.
 */

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { captureAlphaEvent } from "@/lib/posthogClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  ClipboardList,
  Gauge,
  MessageCircle,
  PackageSearch,
  Sparkles,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";

const DIAGNOSTIC_ROUTE = "/v1/diagnostic";

interface PathStep {
  icon: JSX.Element;
  title: string;
  description: string;
}

const PATH_STEPS: PathStep[] = [
  {
    icon: <ClipboardList className="w-5 h-5" />,
    title: "6-question diagnostic",
    description: "Quick read on where your brand builds trust and where it leaks it.",
  },
  {
    icon: <Gauge className="w-5 h-5" />,
    title: "Your Trust Gap™ scorecard",
    description: "Four pillars, each scored out of 25, with Trevor's read on your biggest gap.",
  },
  {
    icon: <PackageSearch className="w-5 h-5" />,
    title: "Import your Amazon listing",
    description: "Give us your ASIN and we pull your listing and real customer reviews — no copy-pasting.",
  },
  {
    icon: <MessageCircle className="w-5 h-5" />,
    title: "A short conversation with Trevor",
    description: "The AI brand coach digs into who your customer is and what they're really buying.",
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: "Your Signature",
    description: "The one truth of what your customer is REALLY buying — grounded in their own words.",
  },
];

export default function BetaWelcome(): JSX.Element {
  // Funnel: top of the Alpha journey
  useEffect(() => {
    captureAlphaEvent('beta_welcome_viewed', { referrer: document.referrer || null });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="max-w-2xl mx-auto py-10">
        {/* Framing */}
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4 text-sm">
            Alpha · Invited testers
          </Badge>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Find out what your customers are really buying
          </h1>
          <p className="text-lg text-muted-foreground">
            You're one of the first people to try the IDEA Brand Coach™ — built on
            the IDEA Strategic Brand Framework™ by brand strategist{" "}
            <span className="font-medium text-foreground">Trevor Bradford</span>.
            It reads your brand the way Trevor would: where you're building trust,
            where you're leaking it, and the deeper truth your customers recognise
            but you've never put into words.
          </p>
        </div>

        {/* Expectations */}
        <Card className="mb-8 border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 justify-center text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span>About 15 minutes, start to finish</span>
              </div>
              <div className="flex items-center gap-2">
                <PackageSearch className="w-4 h-4 text-primary shrink-0" />
                <span>Bring your Amazon ASIN (or listing URL)</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span>Open for the next 7 days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* The path */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Here's the path</h2>
            <ol className="space-y-4">
              {PATH_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    {step.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">
                      <span className="text-muted-foreground mr-1.5">{index + 1}.</span>
                      {step.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Why their reaction matters */}
        <p className="text-sm text-muted-foreground text-center mb-8">
          This is early. Your honest gut reaction — especially where something feels
          off — is exactly what we need. A quick feedback prompt at the end takes
          two taps.
        </p>

        {/* CTA */}
        <div className="text-center">
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link to={DIAGNOSTIC_ROUTE}>
              Start the diagnostic
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
