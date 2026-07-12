# 3D Product-Model Fidelity — Investigation & Spike

**Status:** spike wired (Higgsfield `generate_3d` routed into the reference kit); live fidelity
test is the manual step below. **Owner decision pending:** go/no-go on paying for a dedicated 3D API.

## Why this exists

Current AI image tools (our `generate_listing_image` → Nano Banana Pro path, and Higgsfield
`generate_image`) condition on a product **photo** but re-derive the product's geometry on **every**
generation. The result is the well-known "it takes many iterations to get an image that looks
*exactly* like my product" problem — and inconsistency across a set (the binder in the hero shot
doesn't quite match the binder in the lifestyle shot). A faithful **image→3D model**, built once and
rendered from any angle, pins geometry deterministically so every downstream image/video conditions
on the *same* product. That consistency is a genuine edge over image-only tools.

## What was wired (the free spike)

- A `product_model` step added to `HIGGSFIELD_HANDOFF` in `src/mcp/service/creativeAlignment.ts` —
  it propagates verbatim to all six creative-plan directors (they spread `HIGGSFIELD_HANDOFF`).
  It directs: real product photo(s) → Higgsfield **`generate_3d`** (1–4 images → GLB) → render the
  turntable / canonical angles → those stills become the "strict reference / approved still" every
  downstream constant already points at (the `product_reveal` orbit in `videoStoryboard.ts`, the
  main-image hero, `generateListingImage`'s `reference_image_urls`).
- `reference_discipline` now prefers a 3D model over a 2D reference sheet for hard-surface / reused
  products.
- `nativeLedger.normContentType` accepts a `'model'` content type so a GLB + its renders persist via
  `log_asset` (the ledger `content_type` column is free `text` — no migration needed).

Zero new integration, key, or billing: `generate_3d` is already exposed by the Higgsfield connector
the coach uses. This is the fast path to test the hypothesis before spending anything.

## The hard caveat (baked into the handoff)

Image→3D reconstruction **smears small on-pack text and logos** — the model hallucinates unseen
faces, and fine print / logo edges degrade. So the 3D model is a **geometry/shape reference only**;
logos, pack copy and fine text must be **re-applied as a decal/composite or in the final image prompt
from the real photo**. Never trust the reconstruction for legible text. (This is why the spike keeps
the real photo in the loop, not just the GLB.)

## Options compared (2026 research)

| Option | Cost | Free-tier commercial use | Multi-image input | Turntable renders | Best for |
|---|---|---|---|---|---|
| **Higgsfield `generate_3d`** | Free (already connected) | via Higgsfield acct | Yes (1–4 imgs → GLB) | Manual (render the GLB) | The **zero-cost fast path** — start here |
| **Meshy** Multi-Image→3D | ~$20/mo Pro (private, full-ownership license) | Free tier is CC BY 4.0 (attribution, public) | **Yes** (dedicated endpoint) | **Built-in 4-view thumbnails** | The **paid upgrade** when logo/text sharpness or turntable QA is the bottleneck |
| **Rodin / Hyper3D** | Pay-on-download (~$0.30–0.40/gen) | Paid/on-download | Yes | — | **Premium 4K PBR** hero fidelity |
| **Stability SF3D / SPAR3D** | Self-host (open weights) | **Free commercial if rev < $1M** (Community License) | No (single-image) | — | Cost/licensing fallback, self-hostable, ~0.5s/gen |

Reality check across all tools: **none reliably preserves small on-pack text** today — the decal
re-application step is required regardless of which engine we pick.

## Live fidelity test — protocol (manual, needs a real product photo + the Higgsfield connector)

Run this on a real **Infinity Vault** binder photo (opted-in corpus) — do NOT fabricate results.

1. Gather 3–4 real photos of the binder from different angles (front, 3/4, back, spine).
2. Via the Higgsfield connector: `generate_3d` with those images → GLB. Render the turntable +
   canonical hero/detail stills (`brand-assets` bucket, ledger via `log_asset` content_type `'model'`).
3. **A/B the fidelity:** generate the main image twice with `generate_listing_image` —
   (A) `reference_image_urls` = the single hand-shot photo; (B) = the 3D turntable stills.
4. Score each on: geometry/proportions faithful? consistent across a 3-image set? **on-pack text/logo
   legible** (expect B to need the decal re-apply step)? iterations-to-acceptable?
5. Record results in the table below.

### Results (fill from the live run)

| Criterion | (A) photo reference | (B) 3D turntable stills | Winner |
|---|---|---|---|
| Geometry / proportions faithful | _tbd_ | _tbd_ | _tbd_ |
| Consistency across a set | _tbd_ | _tbd_ | _tbd_ |
| On-pack text / logo legibility | _tbd_ | _tbd_ | _tbd_ |
| Iterations to an acceptable image | _tbd_ | _tbd_ | _tbd_ |

## Recommendation framework (decide after the live test)

- **If Higgsfield `generate_3d` geometry is good enough** (even with the decal step for text): ship the
  free path as the default fidelity upgrade for hard-surface products. **No spend.**
- **If geometry/topology is rough or turntable QA is painful:** pay for **Meshy** ($20/mo) for its
  multi-image endpoint + built-in 4-view renders + private commercial license. Cheap, direct upgrade.
- **If premium hero fidelity is needed for flagship shots:** trial **Rodin** pay-per-download for those
  specific assets.
- **If cost/licensing at scale becomes the concern:** self-host **SF3D** (free commercial < $1M rev).

Default recommendation until the test says otherwise: **stay on the free Higgsfield path**; treat Meshy
as the first paid step, gated on the live fidelity evidence above.

## Sources

Meshy ([meshy.ai/api](https://www.meshy.ai/api), [docs multi-image-to-3d](https://docs.meshy.ai/en/api/multi-image-to-3d)),
Rodin/Hyper3D ([hyper3d.ai/pricing](https://hyper3d.ai/pricing)),
Stability SF3D ([huggingface.co/stabilityai/stable-fast-3d](https://huggingface.co/stabilityai/stable-fast-3d)),
Higgsfield generate_3d ([higgsfield-ai/skills](https://github.com/higgsfield-ai/skills)).
