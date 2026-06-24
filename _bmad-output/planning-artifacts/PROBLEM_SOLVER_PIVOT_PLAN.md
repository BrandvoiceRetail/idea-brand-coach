# IDEA Brand Coach — Problem-Solver Pivot Plan

**Source:** Trevor × Matthew, 2026-06-19 ([Fathom](https://fathom.video/calls/718057296)) + InfinityVault/Miko call ([Fathom](https://fathom.video/calls/716949611))
**Grounded by:** a 6-agent BMAD panel (PM/UX/Architect/Strategy/Analyst/QA) verified against `origin/main`.
**For:** Matthew's action item — *"create + send a simplified-UI mockup of the problem-solver flow to Trevor, then implement prompts/briefs."*

---

## 1. The pivot in one line

Stop selling **"brand strategy"** (a belief we must sell first). Start solving **"your listing converts at 5% and the category does 10%"** — a measurable wound the seller already feels and brings to us. *Relocate the value from our framework to their problem.*

## 2. The customer problem this solves

The old flow answered a panic with homework: a stressed Amazon seller bleeding ad spend got a 13-section strategy document + a framework, and "had no idea what to do." This is the same FTUE failure that started this whole effort. The fix is a **single narrowing funnel that answers "what do I do now?" at every screen** and ends with a **finish line** (a paste-ready fix), not a syllabus.

## 3. The simplified UI — 8 screens (panel-synthesized)

1. **Free Trust-Gap Check** *(lead magnet)* — re-skinned `FreeDiagnostic`, ~6 self-report questions framed "find what's costing you sales in 60 seconds." Guest, no login. *Reuse (copy-only).*
2. **Free Trust-Gap result** — `TrustGapScorecard` recast as a "Trust Gap report"; names the **1 biggest gap** in lost-sales language ("buyers can't tell your binder is built to last"); teases the paid fix. Ends on the paywall CTA, **not** the old free Signature path.
3. **"It's free" + credit teaser** *(revised 2026-06-20 — no paywall on the help)* — the whole core loop is free: diagnose + forensic analysis + **1 design brief with up to 10 free revisions**. Frictionless email capture + a 3-tier teaser (Free / Starter / Pro). Money = **credits** for more briefs/listings + Brand-Defense watch, never a gate on the analysis.
4. **Upload your listing** — *net-new, mobile-first (375px)*; big drop target, accepts a phone screenshot; thumbnail + narrated progress.
5. **Forensic report** — prioritized cards: *"what's wrong → why it costs the sale → the fix,"* ordered by impact. The 4-brain read drives which gaps surface but **stays invisible**.
6. **Decision triggers** — a 3–5 item action checklist from the **shipped** `decisionTrigger` engine; each a concrete move ("add a lifetime-warranty badge").
7. **Ready-to-use output** — each trigger → a 7-slot image brief + paste-ready copy from `generate_brief`; `claimGate` surfaces the warranty claim as a friendly one-tap confirm.
8. **Brand Defense / Market Watch** *(v2, teaser only)* — weekly re-scan of your listing + Gamegenic/Ultimate Guard. The subscription retention hook.

## 4. Change → UI map (verified reuse vs net-new)

| Meeting change | UI surface | Status | Note |
|---|---|---|---|
| Reframe free diagnostic → "why your listing under-converts" | Screen 1 (`FreeDiagnostic`+`trustGap.ts`+`TrustGapScorecard`) | **reuse** | Deterministic scoring (no LLM = no hallucination). Copy + lift to V2 shell + 375px. Caveat: scores **IDEA pillars**, not the 4 brain types — don't claim otherwise. |
| Repoint diagnostic→paywall handoff | Screen 2/3 hinge (`JourneyBridge.tsx`) | **partial** | Already the sign-up gate carrying `?gap=`. Swap destination from Signature → upload. **Highest-leverage 1-file change.** Remove the competing free Signature deliverable. |
| Screenshot upload → forensic analysis | Screen 4/5 | **partial** | Multimodal seam EXISTS (`ImageUpload.tsx` + consultant `{type:image}` path, `image-processing.test.ts`). Net-new = the vision→structured-evidence step + a **typed trust-gap-keyed forensic contract**. Must also pull the ASIN's **reviews** (engine consumes text), or the paid read is thinner than the free one. |
| Prioritized "decision triggers" | Screen 6 (`decisionTrigger.ts`, `DecisionTriggerPanel.tsx`) | **partial** | **SHIPPED on origin/main (3e97dfe)** — not a spec. Two gaps: it returns only the #1 trigger (pivot wants 3–5; ranking already exists), and the 4 brain personalities have no home in the shipped 6 triggers. |
| Actionable design briefs + content prompts | Screen 7 (`generateBrief.ts`, `generateConcepts.ts`, `draftAsset.ts`, `claimGate.ts`) | **partial** | Emits exactly Trevor's output. Gap: **MCP-only**, keyed off avatar/canvas not a screenshot. Work = in-app route + seed slots from forensic findings. `claimGate` blocks the InfinityVault warranty claim → surface as friendly confirm. |
| Weekly competitor re-analysis (Brand Defense) | Screen 8 | **net-new** | Engine generalizes to a rival's listing; deferred from week-1 but **designed now** as the retention/subscription engine. |
| 13-section Strategy Document | backstage | **reuse, demoted** | The "overwhelming framework" we're fleeing. Keep as optional deep export; never the first thing a seller sees. Drop the unbacked "messaging conflict" alert. |

## 5. The pleasant surprise — 3 of 4 pieces already shipped on `origin/main`

- ✅ Free Trust-Gap diagnostic (deterministic)
- ✅ Decision Trigger engine (`derivePrior` → Sonnet over verbatim reviews → placement instruction; confidence hidden)
- ✅ `generate_brief` 7-slot brief + copy + PPC + `claimGate`
- ✅ Multimodal upload seam (`ImageUpload` + image message path)
- ❗ **The ONE hard net-new thing:** screenshot → **trust-gap-keyed forensic contract** (this is also the paywall and the biggest risk).

## 6. Week-1 plan (two parallel tracks, on a FRESH branch off `main`)

> The working branch is ~111 commits behind main. `origin/main` has the trigger engine; the stale branch does not. **Build off main.**

- **Track A — Mockup → Trevor (days 1–2):** the clickable simplified-UI prototype (this doc's 3 options), themed InfinityVault, the build-quality→lifetime-warranty fix as the worked example, four-brain logic invisible. → **DONE: 3 options in `_bmad-output/mockups/` (see §9).**
- **Track B — Shippable spine (days 1–5):**
  1. Re-skin `FreeDiagnostic` copy + lift to V2 shell + fix 375px → ship as the **lead magnet + Trevor's demo centerpiece** (real, deterministic).
  2. Repoint `JourneyBridge` CTA → upload flow.
  3. **Prove the one load-bearing seam before any paywall:** upload an InfinityVault screenshot → pull its reviews → feed the **existing** `decisionTrigger` engine → return a typed trust-gap report + ONE `generate_brief` output with the `claimGate` confirm.
  4. **Free core, no Stripe in week-1:** diagnose + analysis + 1 brief (10 revisions) are free; credit tiers come later. First cohort still runs **Wizard-of-Oz** (Matthew/Trevor eyeball before delivery) for quality.

### Reconciliation with the locked this-week tester plan
The locked 6/21 tester plan (minimal FTUE + nav + funnel brief generator + deploy-from-main) and this pivot **share the same spine** (fix FTUE, wire `generate_brief`, build off main, fix 375px). The pivot **re-frames the front door** (diagnostic → forensic, not "brand coach home"). **Decision needed:** does the 6/21 tester onboarding use the current app with minimal FTUE, or wait for the diagnostic-front-door? → see Decision #6.

## 7. Risks (QA-led)

- **A confident-but-wrong analysis.** A model staring at a JPEG produces a beautiful report whether right or wrong. *Free-to-try lowers the stakes — no charge for the first, possibly-wrong answer — but the finding still has to be right.* **Build a 10–15 listing golden-set (incl. InfinityVault + Trevor's hair-care) and gate on a precision check before promoting confidence in the finding.**
- Every claimed gap must **cite observable image evidence**, not inferred psychology. All lift/impact figures are **labeled ranges**, never fabricated precise numbers.
- **Refund path ships in the same sprint as any charge.**
- The free deliverable must **not** give away the paid fix (value-ladder leak).
- Keep the **framework behind the curtain** — the seller never sees "Rational vs Caring" or an IDEA pillar, only the plain fix. (PM/UX's core discipline; if the output is a lecture, we've pivoted nothing.)

## 8. Open decisions (for Matthew / Trevor)

1. **Bind the two ontologies or pick one?** 6-trigger taxonomy is shipped; 4 brain personalities are net-new. → *Recommended (A): diagnose(4-brain) → prescribe(6/7-trigger) with an explicit map; add a new **Reassurance/Safety** trigger (InfinityVault warranty has no clean home in the current 6).*
2. **Source for the "10% category average" benchmark?** Real data source (unbuilt) vs reframe to "fixes that close known trust gaps" vs hand-wave (risky). Decide before it appears in Trevor-facing copy.
3. **First paid cohort: Wizard-of-Oz or automated?** → *Recommended: Wizard-of-Oz until precision is proven.*
4. **Where's the credit line?** *(revised — model is now free-core + credits)* Free = diagnose + forensic analysis + **1 design brief + 10 revisions**. Credits (subscription) = additional briefs, more listings analyzed, Brand-Defense watch. Decide per-credit cost + what each tier (Free/Starter/Pro) includes.
5. **Credit tiers + pricing & Stripe timing.** → *Recommended: ship the free core first; design the Free/Starter/Pro credit tiers (counts + price) once activation proves the loop is worth scaling. Stripe + refund path land with the first paid tier, week-2+.*
6. **Does 6/21 tester onboarding use the current app or wait for the diagnostic front-door?** (reconciliation with the locked tester plan).

## 9. Mockup options drafted (`_bmad-output/mockups/`)

- **A — `problem-solver-flow.html`** — guided **Diagnose → Analyze → Fix → Defend** stepper (≈ panel's "Linear Funnel" + "Report-Card" blend).
- **B — `problem-solver-home.html`** — **command-center home**: the conversion problem is the headline, a prioritized **fix list** is the home, diagnostic/analysis/briefs are actions.
- **C — `problem-solver-report-card.html`** — **Forensic Report-Card**: lead with the paid artifact — the InfinityVault listing annotated with pinned trust-gap callouts, each expanding to its fix + 7-slot brief ("sell the deliverable by showing it"). **Strongest for the Trevor send.**

Panel's other suggested direction, not yet drafted: **Two-Gate "Diagnose then Fix"** and a **Re-Scan Loop / Market Watch** retention framing (v2).

---
*All three mockups are self-contained HTML with a Desktop/Mobile toggle, themed on InfinityVault (real low-conversion brand: build-quality gap → lifetime-warranty fix; rivals Gamegenic + Ultimate Guard).*
