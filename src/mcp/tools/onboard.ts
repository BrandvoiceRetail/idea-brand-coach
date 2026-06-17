/**
 * Layer 2 (prompt + tool) — `onboard` front door.
 *
 * Registers the branded `onboard` PROMPT (the surface that greets a caller and
 * presents both paths) and the `onboard_choose` TOOL (routes a pick to its stub).
 * Both are ANONYMOUS-SAFE: no identity is required or enforced — this runs before
 * any account exists. We only emit a non-reversible caller tag for log correlation.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
  EXTENSION_ID,
} from '@modelcontextprotocol/ext-apps/server';
import {
  buildOnboardSurface,
  buildPathStub,
  buildOnboardPanelHtml,
  ONBOARD_UI_URI,
} from '../service/onboard.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const chooseInput = {
  path: z.enum(['diagnostic', 'upload']),
};

export function registerOnboard(server: McpServer): void {
  // Advertise the MCP Apps UI extension server-side (bidirectional capability
  // negotiation, io.modelcontextprotocol/ui) so capable hosts know to render the
  // `ui://` panel below. Must run before connect; createServer() is pre-connect.
  server.server.registerCapabilities({
    extensions: { [EXTENSION_ID]: { mimeTypes: [RESOURCE_MIME_TYPE] } },
  });

  // PROMPT `onboard` — the anonymous front door. No argsSchema (nothing to collect);
  // returns the branded welcome + two-choice fork as an assistant turn.
  server.registerPrompt(
    'onboard',
    {
      title: 'Onboard — IDEA Brand Coach',
      description:
        'Meet the IDEA Brand Coach and choose how to start: a Simple Diagnostic or a Full Contextual Upload. Anonymous front door — no account needed.',
    },
    () => {
      const surface = buildOnboardSurface();
      safeLog({ event: 'prompt.onboard', caller: userTag(getIdentity()) });
      return {
        description: 'IDEA Brand Coach welcome surface with the two-choice fork.',
        messages: [
          { role: 'assistant', content: { type: 'text', text: surface.markdown } },
        ],
      };
    },
  );

  // TOOL `onboard_choose` — deterministic routing of the front-door pick to its stub.
  server.registerTool(
    'onboard_choose',
    {
      title: 'Choose onboarding path',
      description:
        "Route the front-door choice: 'diagnostic' (a fast Trust Gap read) or 'upload' (bring your brand context). Returns the next-step stub for the chosen path. Anonymous-safe.",
      inputSchema: chooseInput,
    },
    async ({ path }) => {
      const stub = buildPathStub(path);
      safeLog({ event: 'tool.onboard_choose', caller: userTag(getIdentity()), path });
      return {
        content: [{ type: 'text', text: stub.markdown }],
        structuredContent: { path: stub.path, title: stub.title },
      };
    },
  );

  // Interactive branded panel for MCP Apps-capable hosts (io.modelcontextprotocol/ui).
  // `registerAppResource` sets the MCP-app mimeType and carries the listing-level UI
  // metadata (CSP / border preference) hosts review at connection time. The host renders
  // this `ui://` HTML resource in a sandboxed iframe.
  registerAppResource(
    server,
    'onboard-panel',
    ONBOARD_UI_URI,
    {
      title: 'IDEA Brand Coach — onboarding panel',
      description: 'Branded interactive front-door panel (two clickable choices).',
      _meta: { ui: { prefersBorder: false } },
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: RESOURCE_MIME_TYPE, text: buildOnboardPanelHtml() }],
    }),
  );

  // UI-linked tool: the host renders the panel above when this tool is called (it reads
  // `_meta.ui.resourceUri` from tools/list). `registerAppTool` also populates the legacy
  // `_meta["ui/resourceUri"]` key so older hosts that only check that still render.
  // Falls back to the `onboard` prompt on hosts without UI support. Anonymous-safe.
  registerAppTool(
    server,
    'onboard_panel',
    {
      title: 'Open the IDEA Brand Coach panel',
      description:
        'Render the branded interactive onboarding panel (two clickable choices) on MCP Apps-capable hosts. Anonymous-safe; if the host has no UI support, use the `onboard` prompt instead.',
      inputSchema: {},
      _meta: { ui: { resourceUri: ONBOARD_UI_URI } },
    },
    async () => {
      const surface = buildOnboardSurface();
      safeLog({ event: 'tool.onboard_panel', caller: userTag(getIdentity()) });
      return {
        content: [{ type: 'text', text: 'Opening the IDEA Brand Coach onboarding panel — choose a path in the panel.' }],
        structuredContent: { choices: surface.choices },
        _meta: { ui: { resourceUri: ONBOARD_UI_URI } },
      };
    },
  );
}
