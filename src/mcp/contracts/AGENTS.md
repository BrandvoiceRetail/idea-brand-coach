# Artifact Contracts — Agent & Testing Context

Feature-local instructions for `src/mcp/contracts/` — the **single source of truth** for the
output engine. Per `OUTPUT_CONTEXT_MANIFEST.md` §7, contracts are imported by tools, the
context resolver, the artifact store, AND the workbook assemblers; change a contract and you
change every one of them. For the end-to-end audit see
`brand-coach-mcp-planning/E2E_GAP_REPORT.md`.

## What this is

Each artifact kind gets one module pairing `{ kind, outputSchema, requiredContext: SlotId[] }`
(`types.ts:ArtifactContract`). `outputSchema` is the zod shape the generator must produce and
the `artifactStore` validates before any DB write; `requiredContext` is the manifest §4 slot
ids the resolver must fill for that generator to run in evidence mode.

## The pieces

| File | Owns |
|------|------|
| `types.ts` | `ArtifactKind` (11 kinds), `ArtifactContract`, `ContractOutput<C>`. |
| `slots.ts` | The **18 master context slots** (`CONTEXT_SLOTS`), verbatim from manifest §4: `id`, `class` (the §1 trust taxonomy), `residesIn` (resolution order, ends at `ask`), `askQuestion`. `SlotId` literal union, `getSlot(id)`. |
| `grounding.ts` | `groundingSchema` (`evidence`\|`inference`), `evidenceRefSchema`, `groundingEnvelope` (mixed into every generator outputSchema), `needsInputItemSchema` (the clarification block). |
| `index.ts` | Barrel + `CONTRACTS` registry keyed by `ArtifactKind`. |
| `<kind>.ts` | One per artifact kind (diagnosticInterpretation, avatarS1-S4, positioning statement, brandCanvas, exportBrief, auditXIdea, marketingAudit, rolloutPlan). |

## CRITICAL invariants (do NOT break)

1. **Slot ids 1..18 are STABLE.** They are referenced statically across the manifest (§2 sheet
   requirements, §5 resolver, §6 gates), the resolver, the writeback, and `needsInputItemSchema`
   (`.min(1).max(18)`). Never renumber. If the manifest gains a slot, append id 19+.
2. **Every generator outputSchema carries the grounding envelope** (`grounding` +
   `evidence_refs[]`). The store enforces `grounding='evidence' ⇒ evidence_refs[] non-empty`
   (`artifactStore.validateArtifact`) — a contract that omits the envelope breaks that gate.
3. **Slot #6 is fabrication-gated** (PRODUCT-TRUTH product claims). Its `askQuestion` says so.
   Any contract whose copy can assert a product/policy claim must route through
   `claimGate.scanBrief` before persistence (today only `export_brief` does).
4. **`CONTRACTS` must list every `ArtifactKind`.** It is `Readonly<Record<ArtifactKind, …>>`,
   so a missing kind is a type error — keep them in sync when adding a kind.
5. **Fixtures-parse-against-contracts** is the Phase-0 invariant: every gold-fixture table column
   maps to a schema field, and the fixtures parse clean.
6. **Every user-enterable field has a real `residesIn` store before `ask`** (store-and-resurface,
   [`docs/architecture/STORE_AND_RESURFACE.md`](../../../docs/architecture/STORE_AND_RESURFACE.md)).
   A slot whose `residesIn` is `['ask']`-only is write-only — the field is captured somewhere the
   resolver never reads, so the coach asks for it again. When a field is written by more than one
   surface (app scrape vs connector ingest), `residesIn` must name **every** store that holds it —
   e.g. listing #3 reads `evidence_snapshots` AND `user_products`; reviews #1 reads
   `user_product_reviews` AND `evidence_snapshots`.

## Manifest-vs-implementation divergences (recorded so readers don't trust the manifest literally)

- **`business_facts` is a TABLE, not a KB category.** Manifest §5/§7 said "new KB category
  `business_facts`". The `user_knowledge_base` category CHECK forbids it, so BUSINESS-FACT /
  PRODUCT-TRUTH-confirmation answers land in a dedicated `business_facts` table (migration
  `20260606000000`) keyed by `field_identifier = <slot id>`, with `structured_data` +
  `is_current`/`version`. The slot `residesIn` correctly lists `business_facts` as a store.
- **IV-OS (`ivos_mcp`) reader is deferred.** Slots #5/#6/#11 list `ivos_mcp` in `residesIn` but
  the resolver omits that reader (IV-tenant-only, future) — those slots fall through to `ask`
  for non-IV callers. The slot definitions are correct; the reader is intentionally absent.

## How to test

```
npm run typecheck:mcp        # exit 0 — contracts are the type backbone; this catches most breakage
npx vitest run --dir src/mcp # 229 passed — includes the fixtures-parse-against-contracts suites
```

When you change a contract: (1) re-run typecheck (downstream tools/assembler/store will fail to
compile if the shape moved), (2) re-run the fixture-parse tests, (3) check the assembler still
projects every column (`src/mcp/service/workbook/`), (4) if you touched grounding/slots, re-run
the resolver suite (`contextResolver.test.ts`, 20 tests across all 6 statuses).

## Guardrails

- Contracts are Layer 0 — no I/O, no Supabase, no edge-fn calls. Pure zod + types.
- `src/mcp/server.ts` + `server.test.ts` (the 24-tool array) belong to registrar agents — never
  edit them from a contract change.
- TypeScript strict, no `any`, explicit return types.
