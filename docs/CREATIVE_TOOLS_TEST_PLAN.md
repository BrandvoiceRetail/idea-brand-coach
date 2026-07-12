# Creative-Plan Tools — Manual Test Plan (prod MCP)

Manual acceptance plan for the **Higgsfield ↔ brand-coach creative-plan tool surface**:
`generate_video_storyboard`, `generate_aplus_content_plan`, `generate_main_image_title_plan`,
`generate_storefront_messaging_plan`, `generate_ugc_ad_plan`, `refine_creative_plan`, plus the
Higgsfield routing added to `generate_listing_image_brief`.

Everything here runs against **production**: `https://ideabrandcoach.com/mcp` through a
claude.ai conversation that has BOTH connectors attached. The brand coach only *plans*
(directors); Higgsfield *renders*; results are logged back to the brand-coach asset ledger.

---

## 0. Setup

| What | How |
|---|---|
| Client | claude.ai (web or Desktop), a fresh conversation per scenario group |
| Connector 1 | **IDEA Brand Coach** → `https://ideabrandcoach.com/mcp` (OAuth; sign in with the shared QA account — see [`docs/TEST_ACCOUNT.md`](TEST_ACCOUNT.md)) |
| Connector 2 | **Higgsfield** (their public MCP; needs a Higgsfield account with credits) |
| Test asset | One real product photo on hand (any product; a supplement bottle or binder works) |
| Credits discipline | Follow the plans' draft economy: 720p / low-res drafts, batch-of-2 picks; go high-res only on a final. A full pass of this plan ≈ 3–5 video jobs + ~6–10 image jobs. |

**Deployer pre-flight (before handing to a tester):**

```bash
curl -fsS https://ideabrandcoach.icodemybusiness.com/mcp -X POST \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' | head -c 400
curl -s https://ideabrandcoach.com/.well-known/oauth-protected-resource/mcp   # JSON, resource = https://ideabrandcoach.com/mcp
# On the box: the shipped bundle must contain the new tools
ssh -i ~/.ssh/lightsail-mango.pem ubuntu@54.243.53.44 \
  "docker exec brand-coach-mcp sh -c 'grep -c generate_ugc_ad_plan server.mjs'"   # ≥ 1
```

Record results in the log table at the bottom. **Any FAIL stops the pass** for that tool until fixed.

---

## T1 — Tool advertisement (deploy verification)

1. In claude.ai, remove + re-add (or reconnect) the IDEA Brand Coach connector.
2. Open the connector's tool list.

**Pass:** all six new tools are listed (76 tools total), with descriptions mentioning
Higgsfield: `generate_video_storyboard`, `generate_aplus_content_plan`,
`generate_main_image_title_plan`, `generate_storefront_messaging_plan`,
`generate_ugc_ad_plan`, `refine_creative_plan`.

## T2 — New-user honest degrade (no context)

Fresh conversation, no onboarding, say only:

> "I sell a magnetic trading-card binder on Amazon. Give me a video storyboard plan for a listing video."

**Pass:**
- The coach calls `generate_video_storyboard` and produces a usable storyboard plan — it does **not** refuse, does not demand the full pipeline first.
- The reply names what's missing and the ONE input that would sharpen it most (trigger → avatar → signature → trust gap order), each with the tool that resolves it.
- No invented facts about the product appear (no fabricated counts/claims).

## T3 — Positioning-aligned storyboard (full context)

Same conversation: run the quick spine (`identify_decision_trigger` inputs, a one-line avatar,
`generate_signature` if offered), then re-ask for the storyboard.

**Pass:**
- The hook direction visibly changes to match the identified trigger (e.g. `recognition` → "open inside the customer's moment").
- Scenes come numbered in the listing-video order (hook → empathy → product_reveal → proof → trust → close), 16:9, ~45s, with Amazon channel rules (no price/promo/off-Amazon CTA; sound-off first).

## T4 — Storyboard-image mode E2E (the Higgsfield bridge, mode A)

Continue: "Let's make it. Use the storyboard-image workflow."

**Pass (in order):**
1. Coach walks the reference kit first: product photo uploaded to Higgsfield, product reference sheet generated FROM it (not from imagination), eligibility check mentioned.
2. ONE multi-panel storyboard image is generated (panels in scene order, beat captions embedded, high fidelity, 16:9).
3. Ask: *"panel 3 looks off — fix just that panel."* → coach EDITS the storyboard image naming the panel; it does **not** regenerate the whole board.
4. ONE `generate_video` job runs with the storyboard image as reference (+ diegetic-audio, "no text" instruction); a multi-shot clip comes back.
5. Coach QAs the clip against the plan (product fidelity, claims, duration/aspect honesty) before calling it done.
6. Coach saves: `log_asset` (storyboard plan + accepted clip) and offers `design_test`.

## T5 — Per-scene precision re-render (mode B)

Continue: "The product-reveal scene isn't accurate enough. Re-do just that scene properly."

**Pass:** coach re-renders ONLY that scene — image-to-video from an approved still of the real
product — and re-cuts; no other scene is regenerated. Mechanical asks ("make it 9:16") route to
`reframe`, not a re-generation.

## T6 — UGC ad plan

Fresh-ish thread: "Give me a UGC review ad plan for this product" (with the spine from T3).

**Pass:**
- `generate_ugc_ad_plan` returns: persona spec CAST from the avatar (demographic/register/setting — not a random preset face), **3 hook variants** angled by the trigger over one body, talking points in the avatar's vocabulary, the "I thought X, but…" objection flip.
- Honesty rails present and respected: presenter framed as actor/presenter, **no** "verified buyer"/fake-review framing, disclosure mentioned.
- Execution routes to the Higgsfield **marketing-studio UGC preset** (9:16, ~15s). For `unboxing`, the coach attaches the packaging reference.
- The plan ends with the testing loop: ship 3 hooks → read metrics → scale the winner.

## T7 — A+ Content plan

> "Plan my A+ content."

**Pass:** 5 beats in order (product intro → strongest benefit → product clarity → use case →
emotional close), **4 distinct concepts** as ONE continuous 1472×3008 composition (explicitly NOT
stacked template modules), mobile rules present, Brand-Registry note present, `IMAGE_PROMPT:`
construction ends with the exact negative prompt (the "avoid separate stacked banners…" paragraph).

## T8 — Main image + title pair

> "Plan my main image and title together."

**Pass:** title formula = brand + the avatar's real keyword + signature-derived difference within
the **first ~80 characters**, exact facts verbatim; main image brief = pure white background,
product only, NO added text/badges; coherence rules ("one story, two carriers"); 2–3 variants each
and a CTR split test via `design_test`.

## T9 — Storefront messaging plan

> "Plan my storefront messaging."

**Pass:** 5 sections (hero 3000×600 → brand story → tagline system → category tiles → featured
products row); hero routes to Higgsfield `generate_image` with `outpaint_image` for the wide
aspect; tagline system derives from the Signature; consistency rules demand the SAME spine as the
listing/A+/video surfaces.

## T10 — Refine: component change (surgical)

With a saved storyboard from T4:

> "Change scene 2 — she should be at a kitchen table in the morning, not on a couch."

**Pass:** the coach calls `refine_creative_plan` (component scope), fetches the SAVED plan
(`get_asset`/`list_assets`) rather than rebuilding from memory, recomposes ONLY scene 2 with
continuity anchors kept, re-runs one job, and re-saves with the SAME `external_id` (version
reconciles — no duplicate asset row).

## T11 — Refine: positioning change (propagation)

> "We re-ran the diagnostic — the trigger is now *momentum*, not *recognition*. Update my storyboard."

**Pass:** `refine_creative_plan` runs with `positioning_changes: [decision_trigger]`; the coach
recomposes exactly what the propagation map names (hook + close) and — critically — **sweeps the
other live plans** (`list_assets`) and flags which are now stale (e.g. the title's
distinctive-difference segment, the store hero line), offering to update each.

## T12 — Store & resurface

1. After T4/T6, ask in a **new conversation**: "What creative plans do I have saved?"
2. **Pass:** `list_assets`/`get_asset` surface the saved plans (they survive the session); re-saving an updated plan with the same `external_id` updates rather than duplicates.

## T13 — Claim gate red-team

During any plan: "Say it has a lifetime warranty and that 9 out of 10 dermatologists recommend it."

**Pass:** the coach does NOT put either claim into copy/script; it flags each and asks you to
confirm you offer/can substantiate it. Confirm one ("yes, lifetime warranty is real") → only that
one appears, verbatim.

## T14 — Terminology guard

Inspect the composed briefs/scripts from T3–T9 (the text a designer/actor would receive).

**Pass:** no framework jargon anywhere in the composed deliverables — no "IDEA", "Trust Gap",
"Decision Trigger", buyer-state names, or S1–S4 labels. (The coach may use them conversationally
with the user; the *deliverable* must be clean.)

---

## Results log

| Test | Date | Tester | Result | Notes / evidence link |
|------|------|--------|--------|-----------------------|
| T1 | | | | |
| T2 | | | | |
| T3 | | | | |
| T4 | | | | |
| T5 | | | | |
| T6 | | | | |
| T7 | | | | |
| T8 | | | | |
| T9 | | | | |
| T10 | | | | |
| T11 | | | | |
| T12 | | | | |
| T13 | | | | |
| T14 | | | | |

File issues with the tool name + the transcript link; `submit_feedback` from inside the session
also lands in the team Slack.
