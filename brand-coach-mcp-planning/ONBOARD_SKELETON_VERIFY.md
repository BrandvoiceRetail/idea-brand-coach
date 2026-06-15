# Onboard Walking Skeleton — Claude Desktop Verification

Proof-of-life for the install → invoke → render → choose pipe of the brand-coach MCP
**onboarding front door**. The automated gates (typecheck, lint, vitest, live-HTTP
protocol self-test) all pass; the one thing a human must confirm with their own eyes is
that the branded fork **renders inside Claude Desktop** and that clicking each path
routes to its stub.

Shipped surface: a **branded-markdown `onboard` prompt** + an `onboard_choose` tool.
The interactive HTML panel (STRETCH) was intentionally not built — see "On the panel" below.

---

## What you're verifying
1. The custom connector installs and Claude sees the `onboard` prompt + `onboard_choose` tool.
2. Invoking `onboard` renders the **branded IDEA Brand Coach** surface — name + the line
   *"What captures the heart goes in the cart"* — presenting **exactly two choices**:
   Simple Diagnostic and Full Contextual Upload, each with a clear next-step description.
3. Choosing each path returns a **distinct stub** that names what that path will do next.
4. It all works with **no login** (anonymous front door).

---

## Boot the gateway
From the worktree root
(`.../idea-brand-coach/.claude/worktrees/onboarding`):

```bash
npm install        # first time only
npm run mcp:dev    # watch mode; or: npm run mcp:start
```

Expected boot log:
```json
{"level":"info","event":"http.listening","port":8787,"mcpPath":"/mcp","ivosConfigured":false}
```

- **Local MCP URL:** `http://localhost:8787/mcp`
- Liveness check: `curl http://localhost:8787/healthz` → `{"status":"ok"}`

(Port is `MCP_PORT`, default 8787, from `src/mcp/config.ts`; path `/mcp` from `src/mcp/http.ts`.)

---

## Add the connector in Claude Desktop
1. **Settings → Connectors → Add custom connector**.
2. Name: `Brand Coach (local)`. Remote MCP server URL: **`http://localhost:8787/mcp`**.
3. Save. The connector should connect (no auth required).

## Invoke and render
4. Open a **new chat**.
5. Bring in the prompt: open the connector's prompt menu (the `+` / prompts picker) and
   select **`onboard`** (alternatively, ask Claude to "use the onboard prompt from Brand Coach").
6. **See the branded fork:** the IDEA Brand Coach header, the *"What captures the heart goes
   in the cart"* line, and the two numbered choices with descriptions.

## Choose each path
7. **Diagnostic:** say "diagnostic" (or let Claude call `onboard_choose` with
   `path: "diagnostic"`). Expect the **Simple Diagnostic — your next step** stub (mentions
   the **Trust Gap**, flagged as front-door-only).
8. **Upload:** in a fresh turn/chat, choose **Full Contextual Upload** (or `onboard_choose`
   with `path: "upload"`). Expect the **Full Contextual Upload — your next step** stub
   (mentions bringing listings/reviews, flagged as front-door-only).

✅ If you see the branded fork and each choice yields its own distinct stub, the skeleton
is proven end to end.

---

## Optional: re-run the automated protocol self-test
With the gateway running:
```bash
npx tsx .agent-build/onboard-selftest.mts
```
Drives initialize → prompts/list → prompts/get → onboard_choose (both paths) over real
streamable HTTP as an anonymous client. Prints `SELFTEST: ALL PASS`.

---

## On the panel (RENDERS in Claude Desktop — confirmed 2026-06-14)
The interactive HTML panel is built to the MCP Apps spec (`io.modelcontextprotocol/ui`):
the `onboard_panel` tool + the `ui://brand-coach/onboard` resource
(`text/html;profile=mcp-app`), server advertises the UI extension capability.

**Verified result (2026-06-14): it renders AND is interactive in Claude Desktop** — branded
card (IDEA Brand Coach header + tagline), both buttons, and clicking a choice routes through
`onboard_choose` and shows the stub inline ("Done. Pick again to compare.").

The 2026-06-13 "does not render" result was an **app-side** bug, not host bug #165. The panel
then hand-rolled the postMessage handshake, which skips the web sandbox-proxy handshake that
claude.ai/Desktop use, sent `capabilities` instead of `appCapabilities`, and awaited a
`tools/call` response instead of the `ui/notifications/tool-result` notification. Fix: the
iframe client is now the official **`@modelcontextprotocol/ext-apps`** `App`
(`app.connect()` + `app.callServerTool`), bundled inline via `npm run build:panel`
(`src/mcp/panel/onboardPanelClient.ts` → `…generated.ts`); the tool/resource use
`registerAppTool`/`registerAppResource`.

To try the panel yourself: ensure the gateway runs (`npm run mcp:start`, :8787), Claude
Desktop connected via the `brand-coach-local` connector, new chat, "use the onboard_panel
tool from brand-coach-local". Success = a branded card with two working buttons renders inline.

Note: you can't automate the check — production Claude Desktop refuses `--remote-debugging-port`
(no CDP), and `screencapture` needs Screen-Recording permission. A human eyeball is the
practical confirmation.

---

## 6-line manual checklist
1. `npm run mcp:dev` → log shows `http.listening` on `:8787`; `curl …/healthz` → `{"status":"ok"}`.
2. Claude Desktop → Settings → Connectors → Add custom connector → URL `http://localhost:8787/mcp`.
3. New chat → invoke the `onboard` prompt from the connector.
4. Confirm branded fork: "IDEA Brand Coach" + "What captures the heart goes in the cart" + the two choices.
5. Choose **Simple Diagnostic** → Trust-Gap stub; choose **Full Contextual Upload** → upload stub (distinct).
6. Confirm it worked with **no login** (anonymous).
