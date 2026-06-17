# Brand Funnel Tracker — UX Design Spec (v0)

Companion to [`funnel-tracker-mockups.html`](./funnel-tracker-mockups.html). Authored with the BMAD `create-ux-design` methodology (discovery → inspiration → design-system → defining-experience → screens & states → component strategy → UX patterns). Net-new feature — see [`../SPEC.md`](../SPEC.md) for the data model & taxonomy.

## 1. UX goal & principles
**Goal:** a brand owner pulls up one dashboard and instantly knows — across their whole funnel — what's on-brand, what's gone stale, what's off-strategy, what's being worked on, and what's being tested, each backed by a metric.

**Principles**
1. **Alignment over inventory.** The unit isn't "do you have the asset" — it's "does it match your avatar + Signature." Colour encodes alignment, not presence.
2. **Always say what to fix next.** Every screen surfaces a prioritised action; nothing is a dead-end list.
3. **Metric-backed.** A flag is only credible next to the number it moves.
4. **Editorial calm.** Trevor's v11 language — warm, confident, behavioural-science-led — not a noisy SaaS dashboard.

## 2. Primary persona
**The founder-brand owner** (Matthew-as-user; Trevor's audience: Amazon / Shopify / DTC). Has refined an avatar + Signature with the coach, now faces ~25 scattered touchpoints and no map. Wants confidence about *where to spend the next hour*, and proof that a messaging change paid off.

## 3. Information architecture
One surface, four tabs (sticky top bar carries brand + active avatar + current Signature):
- **Funnel Map** — orient: the whole funnel, colour-coded, current-vs-desired coverage.
- **What Needs Work** — decide: prioritised gaps with IDEA-dimension scores + the metric each moves.
- **In Progress** — track: queued / drafting / in-review board, Signature version carried forward.
- **Testing & Lift** — prove: before/after on a messaging change → did it lift.

Flow: `Map → (pick a gap) → What Needs Work → "Fix with coach" → In Progress → publish → Testing & Lift → Won feeds back to Map.`

## 4. Screens & states
| Screen | Key components | Empty / loading / error |
|---|---|---|
| **Funnel Map** | coverage meter w/ target marker; 5 stage columns; touchpoint cards w/ status border + score; summary stat strip | **Empty:** pre-upload → "Upload a folder of assets and the coach maps your funnel." **Loading:** skeleton stage columns during audit. **Error:** audit failed → retry on the affected touchpoints only. |
| **What Needs Work** | ranked rows; 4 IDEA dimension bars (`dc-*`); metric + delta; "Fix with coach" CTA | **Empty:** all aligned → celebratory "Your funnel is on-brand. Next audit in 14 days." **Partial:** metric unknown → show score only, label "metric not entered." |
| **In Progress** | 3-column board (Queued / In progress / In review); per-card Signature version; publish-filter status; approve/diff | **Empty:** "Nothing in flight — pick a gap to start." |
| **Testing & Lift** | test cards (Won / Running / No-lift); baseline→result; version pins; lift delta | **Running:** interim value + "not significant yet." **No data:** "tracking — enter result when the window closes." |

## 5. Design-system foundation (reconciled)
Trevor's v11 editorial palette is the visual skin; the project's shipped tokens supply structure. They're the same gold-on-light family.

| Token | Trevor v11 | Project (shipped) | Mockup uses |
|---|---|---|---|
| Canvas | `#F3F2EE` warm off-white | `0 0% 98%` neutral | **`#F3F2EE`** (warmer reads as brand) |
| Ink / primary | `#0B0B0B` / `#1A1A1A` | `220 13% 9%` navy-black | `#1A1A1A` |
| Accent / CTA | gold `#D89B0D` | `47 96% 53%` golden | **`#D89B0D`** (deeper, Trevor's) |
| Card | `#FFFFFF`, radius 8–12px | `bg-card`, `--radius .5rem` | white, 10px |
| Font | Helvetica Neue stack | system sans | Helvetica Neue stack |
| Dimensions | I `#D89B0D` · D `#54B657` · E `#3BA0D1` · A `#F08A00` | (same 4 IDEA pillars) | identical |
| Status | reuse dimension family | destructive `0 84% 60%` | Aligned=green · Stale=gold · Misaligned=orange · Missing=grey |

Light mode only (matches both). Shadows kept subtle per Trevor (`0 4px 20px -8px`), golden glow on primary hover per project `--shadow-brand`.

## 6. Component inventory → project mapping
The mockup's vanilla CSS maps 1:1 to shipped shadcn primitives when built in-app:
- `.tp` / `.card` / `.stat` → `Card` (`rounded-lg border bg-card shadow-sm`)
- `.status` / `.tag` / `.beaker` → `Badge` (`rounded-full … text-xs font-semibold`) variants
- `.btn-gold` → `Button variant="coach"` (golden gradient); `.btn` → `variant="outline"`
- `.meter` / `.dim .track` → the header progress pattern (`h-2 rounded-full bg-muted` + gradient fill)
- `.eyebrow` → small uppercase label utility
- Tabs → shadcn `Tabs`

## 7. Accessibility
- Status never colour-only — paired with a text label (Aligned / Stale / Misaligned / Missing) and a left-border shape (dashed = missing).
- Dimension bars carry numeric value beside the bar.
- Target on the coverage meter is a labelled marker, not hue.
- Contrast: ink `#1A1A1A` on `#F3F2EE` ≥ 12:1; gold used for fills/accents, not body text.

## 8. Open questions (for Matthew + Trevor)
1. Funnel Map orientation: **stage columns** (current) vs. a left-to-right funnel ribbon — which reads faster?
2. Score display: single 0–100 per touchpoint (Map) + 4-dimension breakdown (Needs-Work) — keep both, or show dimensions everywhere?
3. Rename "Misaligned/Stale" to softer coach language (e.g. "Drifted")?
4. Does "Won/Running/No-lift" framing fit, or prefer "Improved / Testing / Flat"?
