# /v4 Onboarding & Connector — Inventory

Read-only audit of the onboarding journey substrate. Goal recap: a new user signs
up, is **strongly** steered to onboard their data via the **Brand Coach connector**
in Claude/ChatGPT (primary path) with a **less-prominent** "set up in the app
instead" link; a **Connector Setup** screen shows how to add the connector +
Windsor + two-case pasteable prompts; ingested data then surfaces in the existing
/v4 funnel screens. All in-app pages gated by login except the external diagnostic
(`/v1/diagnostic*`) and the landing page (`/welcome`).

---

## 1. What exists (with paths)

### Connector-setup content — `public/onboard.html`
Standalone static guide (mango black/gold styling, NOT v23 tokens — it uses its own
hex `:root` vars). Reusable **content/copy** for the in-app ConnectorSetup screen:

- **Add-connector walkthrough (4 steps):**
  1. Open Settings (Claude desktop or `claude.ai`, bottom-left name → Settings).
  2. Connectors → **+** → **Add custom connector** (may live under "Customize").
  3. Paste the URL, name it **IDEA Brand Coach**, click **Add** (no login required).
  4. "You're connected" — the toolset appears in any chat.
- **MCP server URL:** `https://ideabrandcoach.icodemybusiness.com/mcp` (with a copy
  button; the page's `copyUrl()` is the copy-to-clipboard precedent).
- **Claude Code variant:** `claude mcp add --transport http idea-brand-coach https://ideabrandcoach.icodemybusiness.com/mcp`
- **Then:** "open a new chat, run the `onboard` prompt, pick **Simple Diagnostic** or
  **Full Contextual Upload**."
- **Windsor section (analytics):** add the **Windsor.ai** connector in Claude
  alongside Brand Coach (Settings → Connectors), connect ad/analytics accounts
  inside Windsor (one-time), then ask the coach to pull. Key honesty rule:
  *"Brand Coach never fetches data itself — it reads what Windsor exposes and stores
  it against each piece, with an honest '—' for anything you haven't connected."*
- **Existing single pasteable prompt:** `Pull my last 30 days of funnel metrics from
  Windsor and update each piece.`
- **Field→metric mapping:** NOT present as an explicit table. onboard.html only states
  the coach "maps each metric to the right funnel piece and stores it." (The actual
  Windsor field→funnel-piece mapping lives server-side in SERVER_INSTRUCTIONS, not in
  onboard.html — do not assume a table to copy.)

### In-app "onboard without Claude" path — `src/pages/v4/V4Onboarding.tsx`
The /v4 ROOT (index) route. Megaprompt paste → "Read it back to me" → live
read-it-back theatre (`OnboardingReflectionRun`) → Context Card → "Continue to
Diagnose". This **is** the "set up in the app instead" path. v23 dark tokens,
PostHog `v4_onboarding_*` events, honest needs_input/error states. Reusable as the
secondary path target.

### Auth + post-signup redirect — `src/pages/Auth.tsx`
Email/password + Google, sign-in/sign-up tabs, reset/recovery, email-confirmation
panel. **Post-signup redirect:** `defaultRedirect = localStorage 'diagnosticData' ? '/subscribe' : '/'`
(overridable by `?redirect=`). After signup with a session it navigates to that
redirect; with email-confirmation-required it shows the "check your email" panel.
**No onboarding-suggestion step** — it drops the user at `/` (→ VersionGate).

### Routing / gating
- `src/App.tsx` — central static route table. `/` → `VersionGate`; `/welcome` →
  `Landing`; `/auth` → `Auth`; `/v1/diagnostic*` → guest diagnostic; `/v4` →
  `V4Layout` with index `V4Onboarding` + spine stages; `/v4/tools` standalone.
- `src/components/VersionGate.tsx` — when `isV4Forced()` (`VITE_FORCE_V4`), replaces
  `/` with `/v4` for **every** user (guest + authed). Otherwise version-picker.
- `src/components/AuthGate.tsx` — wraps the whole `<Routes>` tree; **only blocks
  render until auth is initialized. It is NOT a per-route login redirect.**
- `src/config/v4.ts` — `V4_ROUTES`, `V4_SPINE`, `isV4Forced()`.
- `src/components/v4/{V4Layout,V4Sidebar,SpineStepper,V4BottomNav}.tsx` — v23 dark
  chrome (`bg-background text-foreground`, content capped ~1100px) to reuse.
- `src/services/v4/*` + `src/pages/v4/V4{Stage,Analyse,Fix,Remeasure,Defend}.tsx` —
  spine screens that already read ingested data with honest no-data.

---

## 2. What's missing for the goal

- **No post-signup onboarding-SUGGESTION screen.** Nothing strongly suggests the
  connector after signup; Auth sends users to `/` → VersionGate → /v4 onboarding
  (the in-app megaprompt path), i.e. the secondary path is currently the default.
- **No discrete TWO-case prepared prompts.** onboard.html has ONE Windsor prompt and
  the `onboard` cold-start prompt. The (a) analytics-available vs (b) not-available
  pasteable prompts do **not** exist as distinct copy blocks — must be authored
  (drafted in §4).
- **onboard.html is not integrated in-app.** Its connector + Windsor copy lives only
  in a static HTML file with non-v23 styling; no React screen reuses it.
- **Login-gating is not enforced per-route.** AuthGate only gates render-until-ready.
  With `VITE_FORCE_V4`, an unauthenticated user landing on `/` is pushed to `/v4`
  and can reach /v4 stages while logged out (they render, then RLS returns empty).
  Goal wants unauthenticated users **redirected to `/auth`** for all in-app routes
  EXCEPT `/welcome` (Landing) and `/v1/diagnostic*` (external diagnostic).
- **No field→metric mapping table** for the user to see (only prose). Optional for
  the screen, but if shown it must be authored from the server-side mapping, not
  invented here.

---

## 3. Recommended component structure

Two new screens, both in the v23 dark chrome, plus a gate.

1. **`OnboardingChoice`** (`src/pages/v4/OnboardingChoice.tsx`) — the post-signup
   screen. PRIMARY, prominent CTA → ConnectorSetup ("Bring your brand in through
   Claude / ChatGPT — fastest, uses data your AI already knows"). LESS-prominent
   text link → existing `V4Onboarding` ("Prefer to set up in the app instead?").
   PostHog: `v4_onboard_choice_viewed`, `v4_onboard_choice_connector`,
   `v4_onboard_choice_in_app`.

2. **`ConnectorSetup`** (`src/pages/v4/ConnectorSetup.tsx` + small components under
   `src/components/v4/onboarding/`) — React port of onboard.html content in v23
   tokens: 4-step add-connector walkthrough, MCP URL + copy button (reuse a shadcn
   pattern, not raw `onboard.html` JS), Claude Code line, Windsor add-connector
   steps, and the **two-case pasteable prompts** (§4) each with a copy button.
   Reuse `CompletenessRing`/`GroundedStrip` style. A "Data's in — take me to my
   funnel" CTA → `V4_ROUTES.DIAGNOSE` (or ANALYSE). PostHog: `v4_connector_*`,
   `v4_connector_prompt_copied {case}`.

3. **Route gate** — add a lightweight `RequireAuth` wrapper (do NOT invent a heavy
   `ProtectedRoute`; AGENTS forbids it) that redirects unauthenticated users to
   `/auth?redirect=…`, applied to /v4 + other in-app routes, with `/welcome` and
   `/v1/diagnostic*` explicitly exempt. Wire `OnboardingChoice` as the new
   post-signup target (Auth `defaultRedirect` → the choice route, or VersionGate
   routes first-time authed users there).

Copy/clipboard: register all new PostHog event names in `src/lib/posthogClient.ts`
(no casts at call sites beyond the established per-page union seam).

---

## 4. Exact copy / prompts to use (grounded in onboard.html)

**MCP server URL** (verbatim): `https://ideabrandcoach.icodemybusiness.com/mcp`

**Claude Code line** (verbatim):
`claude mcp add --transport http idea-brand-coach https://ideabrandcoach.icodemybusiness.com/mcp`

**Two-case prepared prompts** (draft — pasteable into a fresh Claude/ChatGPT chat
with the Brand Coach connector enabled):

**Case A — analytics ARE available (Windsor or otherwise connected):**
```
You have the IDEA Brand Coach connector and my analytics (Windsor.ai or similar).
Onboard my brand: read what you already know about my products, customers, and
reviews, then pull my last 30 days of funnel metrics from my analytics and store
them against each funnel piece. Where a metric isn't connected, mark it "—" rather
than guessing. When you're done, give me my Trust Gap and tell me which funnel
piece is weakest.
```

**Case B — analytics are NOT available:**
```
You have the IDEA Brand Coach connector but no analytics connected yet. Onboard my
brand from what you know about me and what I paste: my product, who it's for, where
I sell, and my goal. Don't invent any numbers — if you need a metric, ask me or
leave it "—". Walk me to my Trust Gap one question at a time, then tell me the one
thing to fix first. (I can connect Windsor.ai later to add real funnel numbers.)
```

**Cold-start fallback** (verbatim from onboard.html): open a new chat, run the
`onboard` prompt, and pick **Simple Diagnostic** or **Full Contextual Upload**.

**Windsor honesty line** (reuse near the prompts): *"Brand Coach never fetches data
itself — it reads what Windsor exposes and stores it against each piece, with an
honest '—' for anything you haven't connected."*

> Guardrail: these prompts must never instruct the coach to invent facts/metrics —
> mirror the connector's no-fabrication posture (each prompt already says so).
