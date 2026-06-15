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
import { IvosLedgerClient } from './ivos/client.js';
import { registerOnboard } from './tools/onboard.js';
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

export interface BuiltServer {
  server: McpServer;
  ivos: IvosLedgerClient;
  edgeFn: EdgeFnClient;
}

export function createServer(
  config: HostConfig = loadConfig(),
  edgeFn?: EdgeFnClient,
  ivosClient?: IvosLedgerClient,
): BuiltServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: assertServerInstructions(SERVER_INSTRUCTIONS) },
  );

  const ivos = ivosClient ?? new IvosLedgerClient(config);
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
  // run_diagnostic / search_user_kb / build_avatar / generate_signature stay blocked
  // on C1 / MF-1 / MF-2 / D2 respectively (see STATUS.xlsx).
  registerRunTrustGapTool(server);

  return { server, ivos, edgeFn: edge };
}
