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
import { registerOnboard } from './tools/onboard.js';
import { instrumentToolLatency } from './instrument.js';
import { registerStructuredFallback } from './structuredFallback.js';
import { registerHealthTool } from './tools/health.js';
import { registerListAssetsTool } from './tools/listAssets.js';
import { registerGetAssetTool } from './tools/getAsset.js';
import { EdgeFnClient } from './edgeFn/client.js';
import { registerGenerateConceptsTool } from './tools/generateConcepts.js';
import { registerPublishFilterCheckTool } from './tools/publishFilterCheck.js';
import { registerDraftAssetTool } from './tools/draftAsset.js';
import { registerDesignTestTool } from './tools/designTest.js';
import { registerRunTrustGapTool } from './tools/runTrustGap.js';
import { registerGetAssetHistoryTool } from './tools/getAssetHistory.js';
import { registerLogAssetTool } from './tools/logAsset.js';
import { registerUpdateAssetStatusTool } from './tools/updateAssetStatus.js';
import { registerRecordAssessmentTool } from './tools/recordAssessment.js';
import { registerGenerateSignatureTool } from './tools/generateSignature.js';
import { registerPersistSignatureTool } from './tools/persistSignature.js';
import { registerGetContextStatusTool } from './tools/getContextStatus.js';
import { registerProvideContextTool } from './tools/provideContext.js';
import { registerIngestEvidenceTool } from './tools/ingestEvidence.js';
import { registerBuildAvatarStageTool } from './tools/buildAvatarStage.js';
import { registerRunDiagnosticEvidenceTool } from './tools/runDiagnosticEvidence.js';
import { registerGenerateCanvasTool } from './tools/generateCanvas.js';
import { registerGenerateBriefTool } from './tools/generateBrief.js';
import { registerGenerateAuditIdeaMapTool } from './tools/generateAuditIdeaMap.js';
import { registerRunMarketingAuditTool } from './tools/runMarketingAudit.js';
import { registerExportWorkbookTool } from './tools/exportWorkbook.js';
import { registerListCoachConversationsTool } from './tools/listCoachConversations.js';
import { registerGetCoachConversationTool } from './tools/getCoachConversation.js';
import { registerGetFunnelAssetsTool } from './tools/getFunnelAssets.js';
import { registerAuditAssetTool } from './tools/auditAsset.js';
import { registerGetFunnelCoverageTool } from './tools/getFunnelCoverage.js';
import { registerSubmitFeedbackTool } from './tools/submitFeedback.js';
import { FeedbackNotifier } from './slack/feedbackNotifier.js';
import { registerCreateAvatarTool } from './tools/createAvatar.js';
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

export interface BuiltServer {
  server: McpServer;
  ivos: LedgerClient;
  edgeFn: EdgeFnClient;
}

export function createServer(
  config: HostConfig = loadConfig(),
  edgeFn?: EdgeFnClient,
  ledgerClient?: LedgerClient,
): BuiltServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: assertServerInstructions(SERVER_INSTRUCTIONS) },
  );

  // Time every tool uniformly (emits mcp_tool_latency per call). Must run before the
  // register*Tool() calls below so their handlers are wrapped.
  instrumentToolLatency(server);

  // Mirror each tool's structuredContent into a text block so connectors that drop
  // structuredContent (e.g. the claude.ai remote connector) still receive the payload —
  // ids, records, transcripts — and aren't left with only a summary line. Same seam;
  // must also run before the register*Tool() calls.
  registerStructuredFallback(server);

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
  registerPublishFilterCheckTool(server, ivos);
  registerDraftAssetTool(server, edge, ivos);
  registerDesignTestTool(server);

  // OWNED diagnostics (convenience): only the pure, gate-free wrap for now —
  // run_diagnostic / search_user_kb / build_avatar stay blocked on C1 / MF-1 / MF-2
  // respectively (see STATUS.xlsx).
  registerRunTrustGapTool(server);

  // Signature output engine: generate_signature wraps the reveal-signature edge fn
  // (verbatim-wrap), persist_signature writes the chosen option through the
  // JWT-bound artifactStore (signatures row + signature artifact chain).
  registerGenerateSignatureTool(server, edge);
  registerPersistSignatureTool(server);

  // Output-engine context layer (manifest §4/§5/§6): get_context_status reports the
  // 18-slot fill map + needs_input; provide_context routes owner answers through the
  // write-back service; ingest_evidence parses/persists reviews + listing snapshots.
  // All three are identity-gated (gateWrite) and never fabricate PRODUCT-TRUTH.
  registerGetContextStatusTool(server);
  registerProvideContextTool(server);
  registerIngestEvidenceTool(server);

  // Avatar 2.0 forensic engine: build_avatar_stage runs one forensic stage (s1
  // vocabulary -> s2 job map -> s3 triggers -> s4 objections) or the full S1->S5
  // pipeline through avatarPipeline. Each stage grounds in resolved reviews + prior
  // artifacts and persists an RLS-scoped artifact; the S5 Signature auto-feed is
  // D2/R-015 gated behind allow_signature. gateWrite identity-gated.
  registerBuildAvatarStageTool(server);

  // Output-engine generators (Phase 4, manifest §2 sheets 3/5/6/7): the
  // evidence-grounded diagnostic leg (run_diagnostic_evidence — binds identity
  // before the interpretation leg, C1), Brand Canvas synthesis (generate_canvas),
  // the Export Brief with the PRODUCT-TRUTH/policy fabrication gate
  // (generate_brief returns needs_input on unconfirmed claims, manifest §6), and
  // the Audit×IDEA cross-map (generate_audit_idea_map). Each validates against its
  // Phase-0 contract, carries grounding evidence|inference, and is gateWrite-gated.
  registerRunDiagnosticEvidenceTool(server);
  registerGenerateCanvasTool(server);
  registerGenerateBriefTool(server);
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

  // Multi-avatar lifecycle (P2): create/list/get avatars; switch the current avatar or the
  // multi-select context set; pin primary; record forensic build state. Each mutating tool is
  // identity-gated + ownership-checked (requireOwnedAvatar) and drives the live brand_avatar_scope RPCs.
  registerCreateAvatarTool(server);
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

  return { server, ivos, edgeFn: edge };
}
