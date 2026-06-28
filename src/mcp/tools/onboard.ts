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
import { assembleOnboardState, type OnboardReadDeps } from '../service/onboardOrchestrator.js';
import { resolve as resolveSlots } from '../service/contextResolver.js';
import { listAvatars } from '../service/avatarLifecycle.js';
import { resolveBrandId } from '../service/avatarOwnership.js';
import { listInventory } from '../service/funnelInventory.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import { appGroundingPreamble } from '../skills/appSkills.js';

const chooseInput = {
  path: z.enum(['diagnostic', 'upload']),
};

/** Live read services bound for the orchestrator (RLS-scoped to the caller). */
const liveOnboardDeps: OnboardReadDeps = {
  resolve: (slots, opts) => resolveSlots(slots, opts),
  listAvatars: () => listAvatars(),
  // Funnel needs the brand id; for an anon/no-brand caller this throws and the
  // orchestrator fails it soft (a brand with no funnel yet is normal at onboarding).
  listFunnel: async () => listInventory(await resolveBrandId()),
};

export function registerOnboard(server: McpServer, onboardDeps: OnboardReadDeps = liveOnboardDeps): void {
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

  // TOOL `onboard_status` — the optimized onboarding pass. One call reads everything we
  // already know about the brand (context fill-map, avatars, evidence, funnel) in a single
  // parallel pass and returns a unified state ending on the ONE next action. RLS-scoped:
  // an anonymous caller resolves to the cold-start next step rather than an error.
  server.registerTool(
    'onboard_status',
    {
      title: 'Onboarding status — what we know + your next step',
      description:
        "GUIDE — read onboarding state + the single warm next step (a READ; it does not pull analytics or run the sequence). Reads everything already on file for the brand — context fill-map, customer avatars, listing/review evidence, and funnel pieces — in ONE efficient pass, and returns a single unified state ending on the ONE highest-leverage next action. Recognition-first (Trevor's doctrine): the `summary` opens by reflecting the user's situation, and `nextAction.invite` is the warm, single, conversation-style ask to deliver — relay it to gather the one piece of context that unlocks the most. Never a form, never framework jargon, never fabrication (unfilled inputs come back as needs_input). Use this for any 'where am I / what's my next step' moment, or to guide onboarding one warm step at a time. When the user instead wants to EXECUTE the full onboarding/refresh (pull their analytics, create funnel pieces, ingest metrics, run the Trust Gap), call `run_onboarding`. RLS-scoped; anonymous callers get the cold-start next step." +
        appGroundingPreamble('onboard_status'),
      inputSchema: {},
    },
    async () => {
      const state = await assembleOnboardState(onboardDeps);
      safeLog({
        event: 'tool.onboard_status',
        caller: userTag(getIdentity()),
        next_action: state.nextAction.id,
        ready_to_derive: state.readyToDerive,
        needs_input: state.context.needsInput.length,
      });
      return {
        content: [{ type: 'text' as const, text: state.summary }],
        structuredContent: { ok: true, ...state },
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
