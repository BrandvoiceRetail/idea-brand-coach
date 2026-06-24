/**
 * MCP App (io.modelcontextprotocol/ui) client for the IDEA Brand Coach onboarding panel.
 *
 * Runs INSIDE the host's sandboxed iframe. Uses the official `@modelcontextprotocol/ext-apps`
 * `App` client, which performs the full sandbox-proxy + `ui/initialize` handshake, auto-resize,
 * and strict-CSP-safe (jitless Zod) operation. A hand-rolled postMessage client got these wrong,
 * which is why the panel fetched but never rendered in Claude Desktop.
 *
 * On a choice the panel does TWO things:
 *  1. `callServerTool('onboard_choose')` — renders the in-panel overview of the chosen path.
 *  2. `sendMessage` (ui/message) — pushes the choice INTO the conversation so the model
 *     continues the flow instead of re-asking which path the user wants. A `callServerTool`
 *     result only returns to this iframe; the model never sees it, so without (2) the chat
 *     stalls and re-asks. Falls back to `updateModelContext` if the host lacks `message`.
 *
 * SOURCE entry only: bundled to a self-contained IIFE string by `scripts/build-onboard-panel.mjs`
 * into `onboardPanelClient.generated.ts`, which the server inlines into the panel HTML.
 */
import { App, applyDocumentTheme } from '@modelcontextprotocol/ext-apps';

// Derive the theme type from the helper itself to avoid a name-collision on the
// package's re-exported `McpUiHostContext` type.
type HostTheme = Parameters<typeof applyDocumentTheme>[0];

interface ToolResult {
  content?: Array<{ type: string; text?: string }>;
}

// What to say in the conversation once a path is chosen in the panel, so the model
// picks up the chosen flow directly instead of re-asking which path the user wants.
const CONTINUE_MESSAGE: Record<string, string> = {
  diagnostic:
    "I've chosen the Simple Diagnostic in the panel. Let's begin now — walk me through it as a conversation, one question at a time, starting with my customer and the heart of my brand. Ask me the first question now; don't re-list the options, and no scoring until I've talked through all four parts of trust.",
  upload:
    "I've chosen the Full Contextual Upload in the panel. Tell me exactly what to share, then I'll paste or attach my listings, reviews, and brand materials so you can ground everything in my real business. Don't re-list the options — just guide me on what to send first.",
};

function renderResult(result: ToolResult): void {
  const out = document.getElementById('out');
  if (!out) return;
  let text = '';
  for (const block of result.content ?? []) {
    if (block.type === 'text' && block.text) text += `${block.text}\n`;
  }
  out.style.display = 'block';
  out.textContent = text.trim() || '(no content)';
}

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

  // Push the choice into the conversation so the model continues the flow. Prefer
  // ui/message (a user turn that drives the next response); fall back to
  // ui/update-model-context (context for the next turn) per host capability.
  async function continueConversation(path: string): Promise<void> {
    const text = CONTINUE_MESSAGE[path];
    if (!text) return;
    const content = [{ type: 'text' as const, text }];
    const caps = app.getHostCapabilities();
    try {
      if (caps?.message) {
        await app.sendMessage({ role: 'user', content });
      } else if (caps?.updateModelContext) {
        await app.updateModelContext({ content });
      }
      // else: host can't accept either — the in-panel overview is the only feedback.
    } catch {
      /* non-fatal: the in-panel overview still rendered */
    }
  }

  // Wire the branded choice buttons. A choice is committed: render the overview,
  // drive the conversation, then leave the buttons disabled so a second click can't
  // inject a duplicate message into the chat.
  for (const btn of buttons) {
    btn.addEventListener('click', async () => {
      const path = btn.getAttribute('data-path');
      if (!path) return;
      setDisabled(true);
      setStatus('Starting…');
      try {
        const result = (await app.callServerTool({
          name: 'onboard_choose',
          arguments: { path },
        })) as ToolResult;
        renderResult(result);
        await continueConversation(path);
        setStatus('Started — continue in the chat below.');
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : 'call failed'}`);
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
