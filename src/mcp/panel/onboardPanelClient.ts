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

interface ToolResult {
  content?: Array<{ type: string; text?: string }>;
}

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

  // Wire the branded choice buttons → `onboard_choose` on the server, render its stub.
  for (const btn of buttons) {
    btn.addEventListener('click', async () => {
      const path = btn.getAttribute('data-path');
      if (!path) return;
      setDisabled(true);
      setStatus('Routing…');
      try {
        const result = (await app.callServerTool({
          name: 'onboard_choose',
          arguments: { path },
        })) as ToolResult;
        renderResult(result);
        setStatus('Done. Pick again to compare.');
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : 'call failed'}`);
      } finally {
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
