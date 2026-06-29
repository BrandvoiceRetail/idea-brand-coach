/**
 * MCP App (io.modelcontextprotocol/ui) client for the IDEA Brand Coach onboarding panel.
 *
 * Runs INSIDE the host's sandboxed iframe. Uses the official `@modelcontextprotocol/ext-apps`
 * `App` client, which performs the full sandbox-proxy + `ui/initialize` handshake, auto-resize,
 * and strict-CSP-safe (jitless Zod) operation. A hand-rolled postMessage client got these wrong
 * (skipped the sandbox-proxy handshake, sent `capabilities` instead of `appCapabilities`, awaited
 * a JSON-RPC response instead of the `ui/notifications/tool-result`), which is why the panel
 * fetched but never rendered in Claude Desktop.
 *
 * SOURCE entry only: bundled to a self-contained IIFE string by `scripts/build-onboard-panel.mjs`
 * into `onboardPanelClient.generated.ts`, which the server inlines into the panel HTML (the host
 * sandbox loads a single self-contained document — no runtime module resolution available).
 */
import { App, applyDocumentTheme } from '@modelcontextprotocol/ext-apps';

// Derive the theme type from the helper itself to avoid a name-collision on the
// package's re-exported `McpUiHostContext` type.
type HostTheme = Parameters<typeof applyDocumentTheme>[0];

/** Each path simply tells the chat what the user picked; the coach continues onboarding from there. */
const CHOICE_MESSAGE: Record<string, string> = {
  diagnostic:
    "Let's start with the Simple Diagnostic. Walk me through the four parts of trust one at a time, beginning with my customer.",
  upload:
    "Let's do the Full Contextual Upload. I'll bring my listings, reviews, and brand materials so you can coach against my real business.",
};

function applyTheme(theme: HostTheme | undefined): void {
  try {
    if (theme) applyDocumentTheme(theme);
  } catch {
    /* theming is best-effort — never block the panel on it */
  }
}

async function main(): Promise<void> {
  const status = document.getElementById('st');
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.choice'));
  const setStatus = (t: string): void => {
    if (status) status.textContent = t;
  };
  const setDisabled = (v: boolean): void => buttons.forEach((b) => (b.disabled = v));

  const app = new App({ name: 'idea-brand-coach-onboard', version: '0.1.0' }, {});

  // Register notification handlers BEFORE connect so none are missed.
  app.onhostcontextchanged = (ctx) => applyTheme(ctx.theme);

  // Wire the branded choice buttons → tell the chat what was picked, then let the coach
  // continue the onboarding. No stub is rendered in the panel; the conversation carries on.
  for (const btn of buttons) {
    btn.addEventListener('click', async () => {
      const path = btn.getAttribute('data-path') ?? '';
      const message = CHOICE_MESSAGE[path];
      if (!message) return;
      setDisabled(true);
      btn.classList.add('chosen');
      setStatus('Starting…');
      try {
        const result = await app.sendMessage({
          role: 'user',
          content: [{ type: 'text', text: message }],
        });
        if (result?.isError) throw new Error('the host declined the message');
        setStatus("Sent to the chat — let's keep going below.");
      } catch (err) {
        setStatus(
          `Couldn't start automatically: ${err instanceof Error ? err.message : 'tell me which path in the chat'}`,
        );
        btn.classList.remove('chosen');
        setDisabled(false);
      }
    });
  }

  setDisabled(true);
  setStatus('Connecting…');
  try {
    await app.connect();
    applyTheme(app.getHostContext()?.theme);
    setDisabled(false);
    setStatus('Ready — choose a path.');
  } catch {
    // No host handshake (e.g. opened outside a host): keep the panel usable rather than dead.
    setDisabled(false);
    setStatus('Ready — choose a path.');
  }
}

void main();
