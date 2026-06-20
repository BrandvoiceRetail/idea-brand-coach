/**
 * Canva Connect integration — wire-contract types.
 *
 * These mirror the request/response shapes the `canva-*` edge functions emit
 * (see `.agent-build/sessions/20260616_canva/canva-contract.md`). The frontend
 * NEVER reads the Canva token tables directly; all data flows through the edge
 * functions via `supabase.functions.invoke`, which keeps everything typed
 * without touching the auto-generated `src/integrations/supabase/types.ts`.
 *
 * Tokens (access_token / refresh_token) are intentionally absent from every
 * shape here — they are server-side-only and must never reach the browser.
 */

/** Connection status returned by `canva-status`. */
export interface CanvaStatus {
  connected: boolean;
  displayName?: string;
  canvaUserId?: string;
  scopes?: string;
  tokenExpiresAt?: string;
}

/** A live Canva design as normalized by `canva-list-designs`. */
export interface CanvaDesign {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  editUrl: string | null;
  viewUrl: string | null;
  updatedAt: string | null;
}

/** An imported-design reference stored by `canva-imports`. */
export interface ImportedDesign {
  id: string;
  canvaDesignId: string;
  title: string | null;
  thumbnailUrl: string | null;
  editUrl: string | null;
  viewUrl: string | null;
  importedAt: string;
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/** Body for `canva-oauth-start`. */
export interface StartConnectRequest {
  returnPath?: string;
}

/** Body for `canva-list-designs`. */
export interface ListDesignsRequest {
  continuation?: string;
}

/** The minimal design payload sent when importing via `canva-imports` add. */
export interface AddImportDesign {
  id: string;
  title?: string | null;
  thumbnailUrl?: string | null;
  editUrl?: string | null;
  viewUrl?: string | null;
}

/** Discriminated union of `canva-imports` request bodies. */
export type ImportsRequest =
  | { action: 'list' }
  | { action: 'add'; design: AddImportDesign }
  | { action: 'remove'; designId: string };

// ---------------------------------------------------------------------------
// Response bodies
// ---------------------------------------------------------------------------

/** Response from `canva-oauth-start`. */
export interface StartConnectResponse {
  url: string;
}

/** Response from `canva-disconnect`. */
export interface DisconnectResponse {
  disconnected: true;
}

/** Response from `canva-list-designs`. */
export interface ListDesignsResponse {
  designs: CanvaDesign[];
  continuation?: string;
}

/** Response from `canva-imports` with `action: 'list'`. */
export interface ListImportsResponse {
  designs: ImportedDesign[];
}

/** Response from `canva-imports` with `action: 'add'`. */
export interface AddImportResponse {
  design: ImportedDesign;
}

/** Response from `canva-imports` with `action: 'remove'`. */
export interface RemoveImportResponse {
  removed: true;
}

/**
 * Result of syncing imported Canva designs into the brand-coach context.
 * Returned by `canva-sync`; also echoed (as `coachUpdated`) by `canva-imports`
 * add/remove, which re-sync the context server-side.
 */
export interface CanvaSyncResponse {
  /** Whether the user_knowledge_base entry was written. */
  coachUpdated: boolean;
  /** Number of imported designs summarized into the context. */
  count: number;
  /** KB category used ('visual_identity' or 'core'), or null if the write failed. */
  category: string | null;
}
