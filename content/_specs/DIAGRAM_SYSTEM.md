# Blog Diagram System — IDEA Brand Coach

Every diagram in `content/blog/_assets/` follows this system. It exists so 100+
diagrams by different authors read as ONE product, stay legible for colorblind
readers, and serve visual learners (clear static structure) and kinetic learners
(purposeful motion) without ever making motion carry the meaning.

## Embedding

- Files: `content/blog/_assets/<post-slug>--<short-name>.svg` (kebab, no spaces).
- In the post markdown, on its own line:
  `![Alt text stating the TAKEAWAY](/blog/assets/<post-slug>--<short-name>.svg "Optional caption")`
- The build renders this as `<figure>` on a glass card; the SVG background must be
  **transparent** (the page is dark `#0B0B0B`; the card adds a subtle glass tint).
- Diagrams render inside `<img>`: **no external fonts, no scripts, no external
  refs** — everything inline. CSS/SMIL animation inside the SVG still plays.

## Canvas & layout

- `viewBox="0 0 1200 675"` (16:9) for full-width concept diagrams; `0 0 1200 400`
  allowed for strips/timelines. Never fixed `width`/`height` attributes beyond
  the viewBox (the page scales it).
- Safe margin 48px all round. Max ~7 labeled elements per diagram — if you need
  more, you need two diagrams.
- Text: `font-family="Inter, system-ui, sans-serif"`. Sizes: titles 30–34,
  labels 22–26, small annotations 18–20 (minimum — the SVG scales down on mobile).
- Text color tokens (never series colors on text):
  ink `#F5F4F0`, dim `rgba(245,244,240,.78)`, faint `rgba(245,244,240,.5)`.

## Color (validated — do not improvise)

Categorical set, validated for the dark surface (lightness band, chroma, CVD
separation ≥ 12 adjacent or direct-labeled, contrast ≥ 3:1) with the dataviz
palette validator:

| Role | Hex | Use |
|---|---|---|
| Gold (primary / the brand, the fix, the highlight) | `#BD860E` | the ONE element the diagram is about |
| Green (good / after / growth) | `#3E9847` | positive states, "after" panels |
| Blue (neutral second entity / info) | `#3E8FC4` | comparison entities, customer-side elements |
| Red (problem / leak / before) | `#CC4F42` | the pain point; ALWAYS paired with a label or icon, never color alone |

- Brighter brand gold `#E7A412` is allowed ONLY for thin strokes/glows on the
  highlight element, not as a fill next to `#BD860E`.
- Structure (boxes, connectors, axes): `rgba(245,244,240,.16)` hairlines, 2px.
- Fills are muted: use the hex at 18–25% opacity with a 2px solid stroke of the
  same hex. Solid fills only for small chips/markers.
- Color follows the ENTITY: if "your listing" is gold in panel 1, it is gold in
  every panel. Never recolor by rank or position.

## Marks

- Lines/connectors 2px, `stroke-linecap="round"`. Arrowheads small (8–10px).
- Bars/segments: 2px gap between adjacent fills; 4px corner radius on data ends.
- Every entity is **direct-labeled** — the diagram must survive grayscale.
- One highlight per diagram: the gold element + at most one annotation callout.
- No drop shadows, no gradients except the glass tint, no 3D, no clip art, no
  emoji, no screenshots of real dashboards (mock simplified UI shapes instead).

## The six archetypes (pick ONE per diagram)

1. **Funnel-position map** — the 5-stage funnel (Awareness → Consideration →
   Purchase → Retention → Advocacy) as a horizontal strip; the post's funnel
   position highlighted gold; the leak marked red. Use when the post localizes a
   problem in the funnel.
2. **Before / after split** — two panels, same entity both sides; red-tinted
   "before" left, green "after" right, with the ONE changed thing labeled. Use
   for rewrite/redesign posts.
3. **Working-session flow** — 3–5 rounded steps left→right (input → coach tool →
   output), tool names in `monospace` chips (gold stroke). Use when the post
   walks a tool sequence.
4. **IDEA scorecard** — 4 horizontal bars (Insight-Driven, Distinctive,
   Empathetic, Authentic), weakest bar red + annotated "the gap". Use for
   trust-gap diagnosis posts.
5. **Decision-trigger pick** — the 6 triggers (permission, recognition, identity,
   belonging, momentum, fear of loss) as chips; the operative one gold, rest
   faint. Use when the post turns on one psychological lever.
6. **Metric trajectory** — one 2px line (or two: entity-colored) over a simple
   time axis, annotation at the inflection ("hook swapped here"). Illustrative
   numbers only — axis labels like "wk 1 … wk 8", never fake precise data.

## Animation (kinetic learners) — optional, disciplined

- **Static-readable first**: the frozen frame must carry the full meaning.
  Motion only REINFORCES: flow direction (dash-draw along a connector), the
  highlight breathing (subtle opacity 0.75↔1), or a before→after value easing in.
- CSS keyframes inside the SVG `<style>`; 3–6s loop; `ease-in-out`; movement
  amplitude small (≤ 8px translate, ≤ 6% opacity swing on structure — the
  highlight may swing more).
- MANDATORY reduced-motion guard inside every animated SVG:
  `@media (prefers-reduced-motion: reduce){ *{ animation: none !important; } }`
- At most ONE animated idea per diagram. Never animate text.

## Boilerplate (copy exactly, then draw inside)

```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-labelledby="t">
  <title id="t">ONE-SENTENCE TAKEAWAY (matches the markdown alt text)</title>
  <style>
    text { font-family: Inter, system-ui, sans-serif; fill: #F5F4F0; }
    .dim { fill: rgba(245,244,240,.78); } .faint { fill: rgba(245,244,240,.5); }
    .hair { stroke: rgba(245,244,240,.16); stroke-width: 2; fill: none; }
    .tool { font-family: ui-monospace, Menlo, monospace; }
    @keyframes flow { to { stroke-dashoffset: -24; } }
    @keyframes breathe { 50% { opacity: .75; } }
    .anim-flow { stroke-dasharray: 12 12; animation: flow 3.5s linear infinite; }
    .anim-breathe { animation: breathe 4s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
  </style>
  <!-- diagram -->
</svg>
```

## Alt text & captions

- Alt text states the takeaway, not the picture: "The trust gap sits in the
  Empathetic pillar — the other three score fine", NOT "bar chart with four bars".
- Caption (optional, in the markdown title string) adds the one-line read of the
  diagram in Trevor's voice. No "Figure 1:" numbering.

## QA checklist (per diagram)

1. Transparent background; viewBox only; no external refs/fonts/scripts.
2. Palette hexes from the table only; text in ink tokens; red never unlabeled.
3. Direct labels on every entity; survives grayscale; ≤ 7 elements.
4. If animated: one idea, reduced-motion guard present, static frame complete.
5. `<title>` + markdown alt state the takeaway; filename `<slug>--<name>.svg`.
6. Renders correctly at 360px wide (mobile) — text still legible.
