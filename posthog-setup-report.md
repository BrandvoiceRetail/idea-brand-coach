<wizard-report>
# PostHog post-wizard report

The wizard completed a targeted server-side instrumentation pass on the brand-coach MCP server. Eight new `captureMcpEvent` calls were added across seven previously uninstrumented tool handlers, covering the full owned asset chain (concepts → draft → publish-filter → design-test), the output engine terminal (workbook export + audit-idea map), and the Trust Gap diagnostic. Exception tracking via `captureMcpException` was added to the `export_workbook` failure path. All edits used the existing `src/mcp/posthog.ts` singleton — no new infrastructure was introduced. Environment variables (`POSTHOG_API_KEY`, `POSTHOG_HOST`) were confirmed present and values written to `.env`.

| Event | Description | File |
|-------|-------------|------|
| `mcp_concepts_generated` | Successful concept generation — first step in the owned asset chain. Properties: `count`, `channel`. | `src/mcp/tools/generateConcepts.ts` |
| `mcp_publish_filter_checked` | Publish-filter compliance gate run. Properties: `verdict` (pass/warn/fail), `violation_count`, `channel`. | `src/mcp/tools/publishFilterCheck.ts` |
| `mcp_asset_drafted` | Brand copy drafted successfully. Properties: `format`, `has_user_context`, `recorded`. | `src/mcp/tools/draftAsset.ts` |
| `mcp_design_test_created` | A/B test spec created — final asset-chain step. Properties: `variant_count`, `primary_metric`, `channel`. | `src/mcp/tools/designTest.ts` |
| `mcp_trust_gap_run` | Trust Gap™ scorecard computed. Properties: `primary_gap`, `overall_score`. | `src/mcp/tools/runTrustGap.ts` |
| `mcp_workbook_exported` | Gold workbook exported successfully. Properties: `which` (A/B), `sheet_count`, `missing_count`, `uploaded`. | `src/mcp/tools/exportWorkbook.ts` |
| `mcp_workbook_needs_input` | Workbook export attempted but artifact chain incomplete. Properties: `which`, `missing_count`. | `src/mcp/tools/exportWorkbook.ts` |
| `mcp_audit_idea_map_generated` | Audit × IDEA map persisted. Properties: `grounding`, `row_count`. | `src/mcp/tools/generateAuditIdeaMap.ts` |

## Next steps

We've built a dashboard and five insights to track MCP tool usage:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/203641/dashboard/753499)
- [MCP Asset Chain Activity (wizard)](https://eu.posthog.com/project/203641/insights/zTGIES0Z)
- [Output Engine Activity (wizard)](https://eu.posthog.com/project/203641/insights/SBKQDmwt)
- [Publish Filter Verdict Breakdown (wizard)](https://eu.posthog.com/project/203641/insights/F0yLR0er)
- [Workbook Export vs Needs Input (wizard)](https://eu.posthog.com/project/203641/insights/DfyPG16k)
- [Diagnostics & Feedback (wizard)](https://eu.posthog.com/project/203641/insights/P9bZbYq6)

## Verify before merging

- [ ] Run a full production build (`npm run build` / `npm run typecheck:mcp`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite (`npm test`) — instrumented call sites may need updated mocks or fixtures.
- [ ] Add `POSTHOG_API_KEY` and `POSTHOG_HOST` to `.env.example` (and any bootstrap/onboarding scripts) so collaborators know what to set.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-javascript_node/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
