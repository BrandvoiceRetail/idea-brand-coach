/**
 * Layer 3 (registration) — assemble the brand-coach MCP server.
 *
 * `createServer()` is a FACTORY: a fresh `McpServer` per call. The HTTP layer builds
 * one per request (stateless transport), which keeps request ids and bound identity
 * isolated across concurrent callers.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  SERVER_NAME,
  SERVER_VERSION,
  SERVER_INSTRUCTIONS,
  assertServerInstructions,
  loadConfig,
  type HostConfig,
} from './config.js';
import type { LedgerClient } from './ivos/capabilities.js';
import { NativeLedgerClient } from './service/nativeLedger.js';
import { composeCoachPreamble, tier1GroundingPreamble } from './service/coachInstructions.js';
import { getServerSupabase, getServiceRoleSupabase } from './supabaseServer.js';
import { registerOnboard } from './tools/onboard.js';
import { instrumentToolLatency } from './instrument.js';
import { registerStructuredFallback } from './structuredFallback.js';
import { registerTerminologyGuard } from './terminologyGuard.js';
import { registerForensicGuard } from './forensicGuard.js';
import { registerHealthTool } from './tools/health.js';
import { registerListAssetsTool } from './tools/listAssets.js';
import { registerGetAssetTool } from './tools/getAsset.js';
import { EdgeFnClient } from './edgeFn/client.js';
import { registerGenerateConceptsTool } from './tools/generateConcepts.js';
import { registerGeneratePositioningMovesTool } from './tools/generatePositioningMoves.js';
import { registerPublishFilterCheckTool } from './tools/publishFilterCheck.js';
// import { registerDraftAssetTool } from './tools/draftAsset.js'; // OFF Alpha surface (Trevor 2026-06-25); re-enable in Beta
import { registerDesignTestTool } from './tools/designTest.js';
import { registerRunTrustGapTool } from './tools/runTrustGap.js';
import { registerGetAssetHistoryTool } from './tools/getAssetHistory.js';
import { registerLogAssetTool } from './tools/logAsset.js';
import { registerUpdateAssetStatusTool } from './tools/updateAssetStatus.js';
import { registerRecordAssessmentTool } from './tools/recordAssessment.js';
import { registerGeneratePositioningStatementTool } from './tools/generatePositioningStatement.js';
import { registerPersistPositioningStatementTool } from './tools/persistPositioningStatement.js';
import { registerGetContextStatusTool } from './tools/getContextStatus.js';
import { registerProvideContextTool } from './tools/provideContext.js';
import { registerRememberTool } from './tools/remember.js';
import { registerRecallTool } from './tools/recall.js';
import { registerIngestEvidenceTool } from './tools/ingestEvidence.js';
import { registerBulkIngestEvidenceTool, registerGetIngestJobTool } from './tools/bulkIngest.js';
import { registerBuildAvatarStageTool } from './tools/buildAvatarStage.js';
import { registerRunDiagnosticEvidenceTool } from './tools/runDiagnosticEvidence.js';
import { registerAssessIdeaDimensionsTool } from './tools/assessIdeaDimensions.js';
import { registerIdentifyDecisionTriggerTool } from './tools/identifyDecisionTrigger.js';
import { registerComputeTrustGapLiftTool } from './tools/computeTrustGapLift.js';
import { registerGenerateCanvasTool } from './tools/generateCanvas.js';
import { registerGenerateBriefTool } from './tools/generateBrief.js';
import { registerGenerateListingImageBriefTool } from './tools/generateListingImageBrief.js';
import { registerGenerateListingImageTool } from './tools/generateListingImage.js';
import { registerGenerateVideoStoryboardTool } from './tools/generateVideoStoryboard.js';
import { registerGenerateAplusContentPlanTool } from './tools/generateAplusContentPlan.js';
import { registerGenerateMainImageTitlePlanTool } from './tools/generateMainImageTitlePlan.js';
import { registerGenerateStorefrontMessagingPlanTool } from './tools/generateStorefrontMessagingPlan.js';
import { registerGenerateUgcAdPlanTool } from './tools/generateUgcAdPlan.js';
import { registerRefineCreativePlanTool } from './tools/refineCreativePlan.js';
import { registerGenerateAuditIdeaMapTool } from './tools/generateAuditIdeaMap.js';
import { registerRunMarketingAuditTool } from './tools/runMarketingAudit.js';
import { registerExportWorkbookTool } from './tools/exportWorkbook.js';
import { registerExportMessagingWorkbookTool } from './tools/exportMessagingWorkbook.js';
import { registerListCoachConversationsTool } from './tools/listCoachConversations.js';
import { registerGetCoachConversationTool } from './tools/getCoachConversation.js';
import { registerGetFunnelAssetsTool } from './tools/getFunnelAssets.js';
import { registerAuditAssetTool } from './tools/auditAsset.js';
import { registerGetFunnelCoverageTool } from './tools/getFunnelCoverage.js';
import { registerSubmitFeedbackTool } from './tools/submitFeedback.js';
import { registerCaptureCorrectionTool } from './tools/captureCorrection.js';
import { FeedbackNotifier } from './slack/feedbackNotifier.js';
import { registerCreateAvatarTool } from './tools/createAvatar.js';
import { registerUpdateAvatarTool } from './tools/updateAvatar.js';
import { registerDeleteAvatarTool } from './tools/deleteAvatar.js';
import { registerListAvatarsTool } from './tools/listAvatars.js';
import { registerGetAvatarTool } from './tools/getAvatar.js';
import { registerSetCurrentAvatarTool } from './tools/setCurrentAvatar.js';
import { registerSetContextAvatarsTool } from './tools/setContextAvatars.js';
import { registerSetPrimaryAvatarTool } from './tools/setPrimaryAvatar.js';
import { registerRecordAvatarBuildTool } from './tools/recordAvatarBuild.js';
import { registerListFunnelInventoryTool } from './tools/listFunnelInventory.js';
import { registerUpsertFunnelTouchpointTool } from './tools/upsertFunnelTouchpoint.js';
import { registerRunFunnelAuditTool } from './tools/runFunnelAudit.js';
import { registerGetFunnelAuditTool } from './tools/getFunnelAudit.js';
import { registerCreateCampaignTool } from './tools/createCampaign.js';
import { registerGetCampaignTool } from './tools/getCampaign.js';
import { registerListCampaignsTool } from './tools/listCampaigns.js';
import { registerUpdateCampaignStatusTool } from './tools/updateCampaignStatus.js';
import { registerIngestCampaignAnalyticsTool } from './tools/ingestCampaignAnalytics.js';
import { registerIngestFunnelAnalyticsTool } from './tools/ingestFunnelAnalytics.js';
import { registerIngestContentPerformanceTool } from './tools/ingestContentPerformance.js';
import { registerGetCampaignMetricsTool } from './tools/getCampaignMetrics.js';
import { registerGetFunnelPieceMetricsTool } from './tools/getFunnelPieceMetrics.js';
import { registerCreateEmailSequenceTool } from './tools/createEmailSequence.js';
import { registerAddEmailStepTool } from './tools/addEmailStep.js';
import { registerGetSequenceTemplateTool } from './tools/getSequenceTemplate.js';
import { registerListSequencesTool } from './tools/listSequences.js';
import { registerGetSequencePerformanceTool } from './tools/getSequencePerformance.js';
import { registerUpdateTestMilestoneTool } from './tools/updateTestMilestone.js';
import { registerGetExperimentLiftTool } from './tools/getExperimentLift.js';
import { registerRunOnboardingTool } from './tools/runOnboarding.js';
import { registerEnsureBrandTool } from './tools/ensureBrand.js';

export interface BuiltServer {
  server: McpServer;
  ivos: LedgerClient;
  edgeFn: EdgeFnClient;
}

export async function createServer(
  config: HostConfig = loadConfig(),
  edgeFn?: EdgeFnClient,
  ledgerClient?: LedgerClient,
): Promise<BuiltServer> {
  // Compose instructions: base SERVER_INSTRUCTIONS + coach_instructions from DB
  let composedInstructions = SERVER_INSTRUCTIONS;

  // Fetch and append coach_instructions if enabled
  if (process.env.COACH_INSTRUCTIONS_ENABLED === 'true') {
    try {
      // Use service-role client for coach_instructions (bypasses RLS during init)
      const supabase = getServiceRoleSupabase();
      const coachPreamble = await composeCoachPreamble(supabase, 'preamble');
      const tier1Preamble = await tier1GroundingPreamble(supabase);

      if (coachPreamble || tier1Preamble) {
        composedInstructions = [
          SERVER_INSTRUCTIONS,
          tier1Preamble,
          coachPreamble,
        ].filter(Boolean).join('\n\n');
      }
    } catch (err) {
      // Fail open: use base instructions if coach_instructions fetch fails
      console.error('Failed to fetch coach_instructions, using base instructions:', err);
    }
  }

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: assertServerInstructions(composedInstructions) },
  );

  // Time every tool uniformly (emits mcp_tool_latency per call). Must run before the
  // register*Tool() calls below so their handlers are wrapped.
  instrumentToolLatency(server);

  // Mirror each tool's structuredContent into a text block so connectors that drop
  // structuredContent (e.g. the claude.ai remote connector) still receive the payload —
  // ids, records, transcripts — and aren't left with only a summary line. Same seam;
  // must also run before the register*Tool() calls.
  registerStructuredFallback(server);

  // Terminology policy (IDEA-POLICY-TERM-001): detect + log any Tier-B/C engine internal
  // (S1–S4 labels, buyer-state names, neuroanatomy) that leaks into a tool's user-facing
  // output. Detection only — a leak is fixed at the source, never silently stripped here.
  registerTerminologyGuard(server);

  // Cost guardrail (Trevor 2026-06-25): cap how many heavy LLM forensic/generation calls one
  // caller can make in a rolling window (~8 Sonnet calls each, no monetization gate yet).
  // Refuses politely past the cap; env-tunable. Cheap deterministic tools pass through.
  registerForensicGuard(server);

  const ivos = ledgerClient ?? new NativeLedgerClient();
  const edge = edgeFn ?? new EdgeFnClient(config);

  // Anonymous front door: the branded `onboard` prompt + `onboard_choose` router.
  // Requires no identity (it runs before any account exists); the two paths are
  // walking-skeleton stubs that name what's coming next.
  registerOnboard(server);

  // Gateway substrate + the consumed IV-OS asset-tracking surface: the STABLE
  // ledger reads, the change-log read, and the identity-gated writes (D5 resolved
  // — see ivos/capabilities.ts). Owned asset-chain tools (concept/publish-filter/
  // draft/test-design) and diagnostic wrappers are deferred.
  registerHealthTool(server, ivos);
  registerListAssetsTool(server, ivos);
  registerGetAssetTool(server, ivos);
  registerGetAssetHistoryTool(server, ivos);
  registerLogAssetTool(server, ivos);
  registerUpdateAssetStatusTool(server, ivos);
  registerRecordAssessmentTool(server, ivos);

  // OWNED asset chain (critical path): concept -> publish-filter -> draft -> test-design.
  // draft_asset and publish_filter_check AUTO-RECORD into the IV-OS ledger (opt-out
  // via record:false; never-fail on degraded writes).
  registerGenerateConceptsTool(server, edge);
  // Positioning moves: generate 2–3 candidate moves (reusing the generate_concepts engine)
  // and score each against the live Coach Criteria with a transparent, deterministic composite.
  registerGeneratePositioningMovesTool(server, edge);
  registerPublishFilterCheckTool(server, ivos);
  // draft_asset is OFF the Alpha surface (Trevor 2026-06-25): it generates generic copy not
  // keyed to the user's own review evidence or their named Decision Trigger — the "good
  // enough" output the product exists to replace. Re-enable in Beta once it is
  // trigger-/evidence-grounded. The tool module (tools/draftAsset.ts) is retained.
  // registerDraftAssetTool(server, edge, ivos);
  registerDesignTestTool(server);

  // OWNED diagnostics (convenience): only the pure, gate-free wrap for now —
  // run_diagnostic / search_user_kb / build_avatar stay blocked on C1 / MF-1 / MF-2
  // respectively (see STATUS.xlsx).
  registerRunTrustGapTool(server);

  // Positioning Statement output engine: generate_positioning_statement wraps the reveal-positioning-statement edge fn
  // (verbatim-wrap), persist_positioning_statement writes the chosen option through the
  // JWT-bound artifactStore (positioning statements row + positioning statement artifact chain).
  registerGeneratePositioningStatementTool(server, edge);
  registerPersistPositioningStatementTool(server);

  // Output-engine context layer (manifest §4/§5/§6): get_context_status reports the
  // 18-slot fill map + needs_input; provide_context routes owner answers through the
  // write-back service; ingest_evidence parses/persists reviews + listing snapshots.
  // All three are identity-gated (gateWrite) and never fabricate PRODUCT-TRUTH.
  registerGetContextStatusTool(server);
  registerProvideContextTool(server);
  registerRememberTool(server);
  registerCaptureCorrectionTool(server);
  registerRecallTool(server);
  registerIngestEvidenceTool(server, edge);
  registerBulkIngestEvidenceTool(server, edge);
  registerGetIngestJobTool(server, edge);

  // Avatar 2.0 forensic engine: build_avatar_stage runs one forensic stage (s1
  // vocabulary -> s2 job map -> s3 triggers -> s4 objections) or the full S1->S5
  // pipeline through avatarPipeline. Each stage grounds in resolved reviews + prior
  // artifacts and persists an RLS-scoped artifact; the S5 Positioning Statement auto-feed is
  // D2/R-015 gated behind allow_positioning_statement. gateWrite identity-gated.
  registerBuildAvatarStageTool(server);

  // Output-engine generators (Phase 4, manifest §2 sheets 3/5/6/7): the
  // evidence-grounded diagnostic leg (run_diagnostic_evidence — binds identity
  // before the interpretation leg, C1), Brand Canvas synthesis (generate_canvas),
  // the Export Brief with the PRODUCT-TRUTH/policy fabrication gate
  // (generate_brief returns needs_input on unconfirmed claims, manifest §6), and
  // the Audit×IDEA cross-map (generate_audit_idea_map). Each validates against its
  // Phase-0 contract, carries grounding evidence|inference, and is gateWrite-gated.
  registerRunDiagnosticEvidenceTool(server);
  // Keystone: derive the four IDEA scores FROM the user's evidence (no scores to type),
  // then compute the Trust Gap via the same deterministic engine. Honesty floor; provisional.
  registerAssessIdeaDimensionsTool(server);
  // The named Decision Trigger™ (the hero output) — bound from the identify-decision-trigger
  // engine so the connector can hand the seller the one lever to fix, not just diagnostics.
  registerIdentifyDecisionTriggerTool(server);
  // Re-measure: deterministic Trust Gap delta between two real diagnostic runs (the
  // "watch the gap close" proof). Pure arithmetic — never fabricates a lift number.
  registerComputeTrustGapLiftTool(server);
  registerGenerateCanvasTool(server);
  registerGenerateBriefTool(server);
  // Amazon listing image-SET design brief (main + gallery), IDEA-grounded; the coach composes
  // per-slot briefs + photoreal prompts. Knows Amazon image conventions; routes photoreal slots
  // away from Canva layout-gen. Director only — never produces images or invents claims.
  registerGenerateListingImageBriefTool(server);
  // Brief-driven image executor: turns a slot's IMAGE_PROMPT + the real product photo into
  // an actual image via Nano Banana Pro (Gemini 3 Pro Image) through gemini-image-generate.
  registerGenerateListingImageTool(server, edge);
  // Creative-plan directors (the Higgsfield <-> brand-coach bridge): positioning-aligned
  // plans for every surface a shopper meets — video storyboard (scene architecture +
  // storyboard-image/per-scene Higgsfield generate_video modes + UGC/unboxing preset
  // routing), A+ content (5 addressable beats, one continuous editorial composition),
  // the main-image+title search-grid pair, storefront messaging (hero/tagline/tiles),
  // and script-level UGC ads (avatar-cast persona + trigger-angled hook variants +
  // honesty rails). All share the positioning spine + propagation map (service/creativeAlignment)
  // and degrade honestly on missing context (new users get a plan, not a wall).
  // refine_creative_plan is the UPDATE path: component changes stay surgical (one scene,
  // one job) and positioning changes propagate across every live plan. Directors only —
  // deterministic, no LLM/edge calls; the host executes on the Higgsfield connector.
  registerGenerateVideoStoryboardTool(server);
  registerGenerateAplusContentPlanTool(server);
  registerGenerateMainImageTitlePlanTool(server);
  registerGenerateStorefrontMessagingPlanTool(server);
  registerGenerateUgcAdPlanTool(server);
  registerRefineCreativePlanTool(server);
  registerGenerateAuditIdeaMapTool(server);

  // Marketing-audit engine (Phase 5, manifest §2 sheet B): run_marketing_audit
  // reproduces gold Workbook B (tiered Investment Matrix + 90-day rollout) from
  // resolved BUSINESS-FACT slots. Revenue (#8) is a hard needs_input gate; numbers
  // are 100% deterministic host-side (auditCalibration + marketingMoves library)
  // and the marketing-audit edge fn enriches prose only — it cannot mutate a figure.
  // gateWrite identity-gated.
  registerRunMarketingAuditTool(server);

  // Output engine TERMINAL (Phase 6, manifest §3): export_workbook renders one of the
  // two Trevor-approved gold .xlsx workbooks from the PERSISTED artifact chain and returns
  // a local file path — NO regeneration (the assemblers are pure over already-persisted
  // content). which:'A' → getChain() → projectWorkbookAArtifacts → assembleWorkbookA (the
  // Brand Coach Mockup); which:'B' → newest marketing_audits row → assembleWorkbookB (the
  // Marketing Investment Audit). Incomplete chains return needs_input (writes nothing);
  // the optional Storage upload is never-fail (the local file is the deliverable).
  // gateWrite identity-gated.
  registerExportWorkbookTool(server);

  // Output engine SET variant: export_messaging_workbook renders the multi-avatar
  // messaging-perception workbook — for ONE planned message (param, else the set Positioning Statement),
  // how each selected avatar perceives it across the four IDEA dimensions, judged ONLY from
  // that avatar's persisted Avatar 2.0 forensics, rolled up to a weakest-link set verdict.
  // Unlike export_workbook (pure read→render), this tool DOES the AI + persistence (so the
  // assembler stays pure): per avatar it reuses an on-file messaging_perception for this
  // message, else invokes the analyze-message-perception engine and persists the result; an
  // avatar with no forensics is emitted honestly as "not yet analysable", never a guessed
  // score. gateWrite identity-gated; every avatar_id must be owned (requireOwnedAvatar).
  registerExportMessagingWorkbookTool(server);

  // Coach conversations (READ, per avatar): list_coach_conversations indexes the caller's
  // Brand-Coach chat threads — each annotated with its avatar (avatar_id + avatar_name;
  // null = brand-level) and turn count — and get_coach_conversation returns one thread's
  // full transcript. Both are RLS-scoped to the caller (identity-gated; anon refused) and
  // read-only. The avatar scope comes from chat_sessions.avatar_id (nullable FK → avatars).
  registerListCoachConversationsTool(server);
  registerGetCoachConversationTool(server);

  // Brand Funnel Tracker (OWNED, brand-coach is system of record; decoupled from D5):
  // see + audit a brand's funnel assets from chat. Reads are RLS-scoped to the caller;
  // audit_asset is identity-gated and reuses the audit-asset edge fn (calculation parity).
  registerGetFunnelAssetsTool(server);
  registerAuditAssetTool(server);
  registerGetFunnelCoverageTool(server);

  // User → team feedback channel: submit_feedback posts a short message to the team's
  // Slack channel via SLACK_BOT_TOKEN + chat.postMessage. NOT identity-gated (anonymous
  // callers may submit so feedback is never lost); the feedback text is the only user
  // content sent and is never logged (MF-5). Degrades gracefully to a clear error when the
  // Slack token/channel is unconfigured/unreachable — never throws.
  registerSubmitFeedbackTool(server, new FeedbackNotifier(config));

  // Brand bootstrap: ensure_brand creates the caller's brand row if missing (idempotent, brand-row
  // only) so a connector-first caller — who signed up for the app (auth) but never triggered the SPA's
  // lazy default-brand create — can get past "no brand found". Must precede the brand-scoped writes.
  registerEnsureBrandTool(server);

  // Multi-avatar lifecycle (P2): create/list/get avatars; switch the current avatar or the
  // multi-select context set; pin primary; record forensic build state. Each mutating tool is
  // identity-gated + ownership-checked (requireOwnedAvatar) and drives the live brand_avatar_scope RPCs.
  registerCreateAvatarTool(server);
  // update_avatar: enrich/edit an existing avatar in place (partial) so the coach fleshes out
  // thin/placeholder avatars instead of creating duplicates. gateWrite + requireOwnedAvatar.
  registerUpdateAvatarTool(server);
  // delete_avatar: clear out placeholder avatars. GUARDED — refuses (returns dependent counts)
  // when the avatar has funnel pieces/tests/diagnostics unless force=true. gateWrite + owned.
  registerDeleteAvatarTool(server);
  registerListAvatarsTool(server);
  registerGetAvatarTool(server);
  registerSetCurrentAvatarTool(server);
  registerSetContextAvatarsTool(server);
  registerSetPrimaryAvatarTool(server);
  registerRecordAvatarBuildTool(server);

  // Brand Funnel inventory (brand-level) + per-avatar audit overlay (avatar-on-demand).
  registerListFunnelInventoryTool(server);
  registerUpsertFunnelTouchpointTool(server);
  registerRunFunnelAuditTool(server);
  registerGetFunnelAuditTool(server);

  // Campaign CRUD (numeric-analytics model): create/get/list campaigns + flip lifecycle status.
  // brand_id is resolved server-side (resolveBrandId); writes are gateWrite-gated, reads RLS-scoped.
  registerCreateCampaignTool(server);
  registerGetCampaignTool(server);
  registerListCampaignsTool(server);
  registerUpdateCampaignStatusTool(server);

  // Numeric-analytics ingestion + read: parse the 3 workbook shapes into campaign_metrics
  // (append-only, upserted on the natural key) and read them back (date_range + breakdown).
  // Honest no_data throughout — the coach reasons over real numbers, never fabricates.
  registerIngestCampaignAnalyticsTool(server);
  registerIngestFunnelAnalyticsTool(server);
  registerIngestContentPerformanceTool(server);
  registerGetCampaignMetricsTool(server);
  // Per-piece read (decision #1): one funnel piece's (brand_asset's) latest-per-metric values
  // + derived cvr/aov — "did this piece do its job?". RLS-scoped; honest no_data.
  registerGetFunnelPieceMetricsTool(server);
  // Experiment-lifecycle write (Gap B): stamp ASSET_CREATED / ASSET_LIVE milestone dates
  // on a split-test (brand_tests) — the dates that start the re-measure clock + the case
  // study. gateWrite-gated, owner-scoped; asset_live also promotes a draft test to running.
  registerUpdateTestMilestoneTool(server);
  // Re-measure read (Gap B): the before/after lift for a split-test's metric on its funnel
  // piece, windowed by its lifecycle dates over campaign_metrics (no snapshot table). Honest
  // pending when not live / no post-live data; status_suggestion is advice the user confirms.
  registerGetExperimentLiftTool(server);

  // Onboarding director: the coach calls run_onboarding (instead of a pasted prompt) when the
  // user hasn't onboarded yet or asks to (re-)onboard. Returns current state + the ordered
  // playbook (create pieces → pull full Windsor history → ingest → Trust Gap) for the host to run.
  registerRunOnboardingTool(server);

  // Email sequences: brand-level sequence records + steps, prebuilt templates (welcome=5 /
  // nurture=7 / abandoned_cart=3), and a deterministic performance read (step count + the linked
  // campaign's email-channel metrics). Honest no_data — never fabricates opens/clicks.
  registerCreateEmailSequenceTool(server);
  registerAddEmailStepTool(server);
  registerGetSequenceTemplateTool(server);
  registerListSequencesTool(server);
  registerGetSequencePerformanceTool(server);

  return { server, ivos, edgeFn: edge };
}
