/**
 * V4ConnectorSetup (/v4/connect) — the PRIMARY post-signup onboarding path.
 *
 * In-app port of `public/onboard.html` in the v23 dark palette (semantic tokens
 * only — `bg-foreground text-background` panels + `gold-warm` accents, matching
 * the /v4 sidebar). Shows: (1) how to add the Brand Coach connector in
 * Claude/ChatGPT, (2) Windsor analytics setup, and (3) two ready-to-paste
 * prompts (analytics available / not available) with copy buttons. A clear
 * "Done — open my Brand Coach" CTA advances to the funnel.
 *
 * Copy is grounded in onboard.html + docs/v4/ONBOARDING_INVENTORY.md §4. The
 * prompts never instruct the coach to invent facts/metrics — they mirror the
 * connector's no-fabrication posture ("—" for anything not connected).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Copy, Plug, BarChart3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { V4_ROUTES } from '@/config/v4';
import { captureAlphaEvent, type AlphaEventProps } from '@/lib/posthogClient';

/** Verbatim from onboard.html — the remote MCP server URL the user pastes. */
const MCP_URL = 'https://ideabrandcoach.icodemybusiness.com/mcp';

/** Verbatim Claude Code variant. */
const CLAUDE_CODE_LINE =
  'claude mcp add --transport http idea-brand-coach https://ideabrandcoach.icodemybusiness.com/mcp';

/** Honest framing reused near the prompts — Brand Coach never fetches data itself. */
const WINDSOR_HONESTY =
  'Brand Coach never fetches data itself — it reads what Windsor exposes and stores it against each piece, with an honest "—" for anything you haven\'t connected.';

/**
 * One casual, conversational opener. The connector coach's `run_onboarding`
 * DIRECTOR tool is built to fire on a plain "onboard / set up my brand" — it then
 * runs the whole sequence itself (read brand context → build funnel pieces → pull
 * whatever analytics are connected → ingest → Trust Gap), and handles the
 * analytics-or-not branching internally, so there's no need for the old two-case
 * walls of text. Keeps the no-fabrication clause so the coach marks "—" instead of
 * guessing.
 */
const ONBOARD_PROMPT = `Hey — can you onboard my brand in IDEA Brand Coach and set up my funnel? Pull in whatever analytics I've already connected, leave anything that isn't as "—" (no made-up numbers), then show me my Trust Gap and the one piece to fix first.`;

interface AddConnectorStep {
  title: string;
  body: string;
}

/** The 4-step add-connector walkthrough (onboard.html). */
const CONNECTOR_STEPS: readonly AddConnectorStep[] = [
  {
    title: 'Open Settings',
    body: 'In Claude (desktop or claude.ai), click your name in the bottom-left and choose Settings.',
  },
  {
    title: 'Connectors → Add custom connector',
    body: 'Open Connectors, click the +, then Add custom connector. (In some versions Connectors lives under Customize.)',
  },
  {
    title: 'Paste the URL and click Add',
    body: 'Name it "IDEA Brand Coach", paste the MCP server URL below, and click Add. No login required.',
  },
  {
    title: "You're connected",
    body: 'The IDEA Brand Coach now appears in your connectors with its full toolset — ready in any chat.',
  },
];

/** The 2-step Windsor analytics walkthrough (onboard.html). */
const WINDSOR_STEPS: readonly AddConnectorStep[] = [
  {
    title: 'Add the Windsor.ai connector in Claude',
    body: 'Same place you added Brand Coach: Settings → Connectors. Add Windsor.ai next to IDEA Brand Coach, then connect your ad & analytics accounts inside Windsor. One-time.',
  },
  {
    title: 'Ask the coach to pull them',
    body: 'In any Brand Coach chat, just ask — the coach maps each metric to the right funnel piece and stores it. Use the prompt below.',
  },
];

/**
 * A dark code/prompt panel with a copy button. Edge-safe clipboard: falls back
 * to a "Press Ctrl+C" hint when the Clipboard API is unavailable (non-secure
 * context) so the button is never a dead end.
 */
function CopyBlock({
  label,
  value,
  onCopied,
  testId,
}: {
  label: string;
  value: string;
  onCopied: () => void;
  testId: string;
}): JSX.Element {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');

  async function handleCopy(): Promise<void> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        setState('copied');
        onCopied();
        window.setTimeout(() => setState('idle'), 1800);
        return;
      }
    } catch {
      // fall through to the manual hint
    }
    setState('manual');
  }

  return (
    <div
      className="overflow-hidden rounded-lg bg-foreground text-background"
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-3 border-b border-background/10 px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gold-warm">
          <span className="h-2 w-2 rounded-full bg-gold-warm" aria-hidden />
          {label}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleCopy()}
          className="min-h-9 gap-1.5 bg-gold-warm text-foreground hover:bg-gold-warm/90"
          data-testid={`${testId}-copy`}
        >
          {state === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {state === 'copied' ? 'Copied' : state === 'manual' ? 'Press Ctrl+C' : 'Copy'}
        </Button>
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words px-4 py-4 text-xs leading-relaxed text-background/90">
        {value}
      </pre>
    </div>
  );
}

/** A numbered walkthrough step card. */
function StepCard({ n, step }: { n: number; step: AddConnectorStep }): JSX.Element {
  return (
    <li className="flex gap-3 rounded-lg border border-border bg-card p-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
        {n}
      </span>
      <div className="min-w-0 space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
        <p className="text-sm text-muted-foreground">{step.body}</p>
      </div>
    </li>
  );
}

export default function V4ConnectorSetup(): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    captureAlphaEvent('v4_connector_setup_viewed');
  }, []);

  const emit = (name: Parameters<typeof captureAlphaEvent>[0], props: AlphaEventProps): void =>
    captureAlphaEvent(name, props);

  const handleDone = (): void => {
    captureAlphaEvent('v4_connector_setup_done');
    navigate(V4_ROUTES.DIAGNOSE);
  };

  return (
    <div className="space-y-8">
      {/* Quiet escape hatch back to the post-signup CHOICE fork (Nielsen #3 —
          user control: arriving here in error must have a clear way out). */}
      <button
        type="button"
        onClick={() => navigate(V4_ROUTES.CHOICE)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        data-testid="connector-back"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to setup options
      </button>

      <header className="space-y-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-gold-light px-3 py-1 text-xs font-semibold text-gold-warm">
          <Sparkles className="h-3.5 w-3.5" />
          Set up your coach in Claude / ChatGPT
        </span>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Bring your brand in through the connector
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Add the IDEA Brand Coach once as a connector, then just ask it to onboard
          you — in plain English. It reads what your AI already knows about your
          brand and analytics, and everything it brings in shows up here in your
          funnel.
        </p>
      </header>

      {/* 1 — Add the connector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plug className="h-5 w-5 text-gold-warm" />
            1 · Add the Brand Coach connector
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3" data-testid="connector-steps">
            {CONNECTOR_STEPS.map((step, i) => (
              <StepCard key={step.title} n={i + 1} step={step} />
            ))}
          </ol>
          <CopyBlock
            label="MCP server URL"
            value={MCP_URL}
            testId="mcp-url"
            onCopied={() => emit('v4_connector_url_copied', { target: 'mcp_url' })}
          />
          <p className="text-sm text-muted-foreground" data-testid="chatgpt-note">
            Using ChatGPT instead? It supports custom connectors too — open
            Settings → Connectors (Developer mode, on Pro / Business / Enterprise)
            and add the same MCP server URL above.
          </p>
          <CopyBlock
            label="Prefer Claude Code?"
            value={CLAUDE_CODE_LINE}
            testId="claude-code"
            onCopied={() => emit('v4_connector_url_copied', { target: 'claude_code' })}
          />
        </CardContent>
      </Card>

      {/* 2 — Windsor analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-gold-warm" />
            2 · Connect your analytics with Windsor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Want the coach to judge each funnel piece on real numbers? Add the
            Windsor.ai connector alongside Brand Coach. {WINDSOR_HONESTY}
          </p>
          <ol className="space-y-3" data-testid="windsor-steps">
            {WINDSOR_STEPS.map((step, i) => (
              <StepCard key={step.title} n={i + 1} step={step} />
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* 3 — One conversational opener (the coach's run_onboarding does the rest) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-gold-warm" />
            3 · Just ask your coach to begin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No setup script — just say this in your Brand Coach chat (or your own
            words). It reads your brand, builds your funnel, pulls in whatever
            analytics you've connected, and gives you your Trust Gap. Works the same
            whether or not your analytics are hooked up yet — anything unconnected
            shows an honest "—", never a guessed number.
          </p>
          <CopyBlock
            label="Say this to your coach"
            value={ONBOARD_PROMPT}
            testId="onboard-prompt"
            onCopied={() => emit('v4_connector_prompt_copied', { case: 'onboard' })}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col items-stretch gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Once the coach has brought your data in, it appears in your funnel here.
        </p>
        <Button
          type="button"
          variant="brand"
          onClick={handleDone}
          className="gap-2"
          data-testid="connector-done"
        >
          Done — open my Brand Coach
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
