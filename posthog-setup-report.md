<wizard-report>
# PostHog post-wizard report

The wizard has completed server-side PostHog integration for the brand-coach MCP server using `posthog-node`. A new singleton client module (`src/mcp/posthog.ts`) was created, and 7 MCP tool files were instrumented with `capture` and `captureException` calls. The existing client-side `posthog-js` integration (in `src/lib/posthogClient.ts`) was left untouched. User correlation works automatically: the MCP server uses the Supabase JWT `userId` as the PostHog `distinctId`, which matches the `userId` already passed to `posthog.identify()` on the frontend.

| Event | Description | File |
|---|---|---|
| `mcp_signature_generated` | MCP `generate_signature` returned Signature options; properties: `options_count`, `grounding`, `used_reviews`, `used_context_bundle` | `src/mcp/tools/generateSignature.ts` |
| `mcp_signature_persisted` | User's chosen Signature was written to DB; properties: `chosen_option`, `grounding` | `src/mcp/tools/persistSignature.ts` |
| `mcp_signature_persist_failed` | `persist_signature` error path; also captures exception via `captureException`; property: `error_class` | `src/mcp/tools/persistSignature.ts` |
| `mcp_evidence_ingested` | Evidence snapshot written (reviews/listing); properties: `reviews_parsed`, `listing_captured` | `src/mcp/tools/ingestEvidence.ts` |
| `mcp_context_provided` | Context-slot answers persisted; properties: `answers`, `persisted`, `failed` | `src/mcp/tools/provideContext.ts` |
| `mcp_avatar_stage_completed` | Single forensic stage (s1–s4) persisted; property: `stage` | `src/mcp/tools/buildAvatarStage.ts` |
| `mcp_avatar_pipeline_completed` | Full S1→S5 pipeline completed; properties: `stages_count`, `signature_gated` | `src/mcp/tools/buildAvatarStage.ts` |
| `mcp_http_error` | Unhandled error in the MCP HTTP layer; also captures exception; property: `error_name` | `src/mcp/http.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics (wizard):** [https://eu.posthog.com/project/195536/dashboard/730156](https://eu.posthog.com/project/195536/dashboard/730156)
- **Signature Creation Funnel:** [https://eu.posthog.com/project/195536/insights/NJkmzvD3](https://eu.posthog.com/project/195536/insights/NJkmzvD3)
- **Signatures Persisted Over Time:** [https://eu.posthog.com/project/195536/insights/Y2DAjawI](https://eu.posthog.com/project/195536/insights/Y2DAjawI)
- **MCP Tool Activity:** [https://eu.posthog.com/project/195536/insights/RScPMQwt](https://eu.posthog.com/project/195536/insights/RScPMQwt)
- **MCP Error Monitoring:** [https://eu.posthog.com/project/195536/insights/OWpYascK](https://eu.posthog.com/project/195536/insights/OWpYascK)
- **Avatar Pipeline Completions:** [https://eu.posthog.com/project/195536/insights/MdgK5yo8](https://eu.posthog.com/project/195536/insights/MdgK5yo8)

Before the MCP server starts firing events, make sure `.env` contains both `POSTHOG_API_KEY` and `POSTHOG_HOST` (set by this wizard). The MCP server must be restarted (`npm run mcp:start`) to pick up the new env vars and the `posthog-node` dependency.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
