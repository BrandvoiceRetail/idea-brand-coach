# Image output-quality eval suite

The **output-quality** tier: it scores the actual **image deliverables** the pipeline produces
— the image a shopper would see — for *how likely they are to help the seller solve their core
problem*, grounded in the **opted-in customer corpus** (Infinity Vault, owner-certified in
`corpus.ts`).

The behavioural suite (`npm run evals` / `evals:live`) scores the **coach** (tool calls +
transcript). This suite scores the **deliverable**: it drives a real session through **two
connectors in one chat** — our IDEA Brand Coach MCP (plan directors) *and* the Higgsfield MCP
(`generate_image`) — then a **vision judge** rules on the produced image against a rubric.

## Pieces

| File | Owns |
|------|------|
| `corpus.ts` | The opted-in ground truth (brand facts, review-derived Trust Gap, resolved trigger, verified vs prohibited claims). |
| `rubric.ts` | `IMAGE_RUBRIC` (problem-fit, trigger-lead, trust-gap-closure, empathetic-lead, distinctive, + hard gates: policy / product-fidelity / no-fabrication) and `scoreImage()` (hard-gate-capped composite). |
| `cases.ts` | `IMAGE_EVAL_CASES` — each names the deliverable under test, the driving query, and the tool calls that prove the E2E pipeline ran (ours **then** Higgsfield `generate_image`). |
| `visionJudge.ts` | The `VisionJudge` contract + the gated Anthropic-vision impl (sees the image bytes/URL). |
| `scorecard.ts` | Pure suite aggregation → per-case `ImageScore` + roll-up. |
| `mcpjamImage.ts` | `evals:image:mcpjam` — emits the MCPJam E2E suite. |
| `runImage.ts` | `evals:image` — scores the produced images, emits the scorecard. |

## Run it (two steps: produce, then score)

**1 — produce images (MCPJam, both connectors):**

```bash
npm run evals:image:mcpjam        # → mcpjam/mcpjam-image-suite.generated.json
```

Load that suite into MCPJam with **both** connectors attached (IDEA Brand Coach + Higgsfield)
and a provider key, and run it. Each test passes in MCPJam when every `expectedToolCalls`
entry appears — the last is the Higgsfield image tool, so **a pass proves an image was actually
rendered E2E**. Collect the produced image URLs into an artifacts file:

```json
// src/mcp/evals/image/artifacts.json
{ "iv-main-image-recognition": { "url": "https://…/hero.png" },
  "iv-lifestyle-empathetic":  { "url": "https://…/lifestyle.png" } }
```

(`base64` is accepted instead of `url` for offline/CI scoring.)

**2 — score deliverable quality (vision judge):**

```bash
ANTHROPIC_API_KEY=… npm run evals:image            # scores artifacts.json
ANTHROPIC_API_KEY=… npm run evals:image -- path/to/artifacts.json
```

Prints the scorecard and writes `<artifacts>.scorecard.json`. **Exit code is non-zero if any
produced image fails or is missing**, so CI can gate on deliverable quality. A case with no
produced image is `missing` (a pipeline failure), not a quality fail.

## Why two tiers

MCPJam's native matcher scores **tool calls** — it proves the pipeline produced *an* image, but
cannot judge whether that image *helps the seller*. "How likely is this to solve the problem?"
is a semantic vision judgment: does it lead with the resolved Decision Trigger, close the
weakest pillar, stay Amazon-policy-clean, keep the product faithful, and state no fabricated
claim? That is the vision judge's job, and the **hard gates** (policy / fidelity / fabrication)
cap the score so a beautiful-but-non-compliant image can't pass.

## Opt-in

`corpus.ts` carries the Infinity Vault brand's own listing facts + the aggregate review pattern,
certified opted in by the brand owner (`support@infinityvaultcards.com`) for eval ground truth.
No individual customer PII is stored — only the brand's own facts and the review-cluster voice.
