/**
 * PostHog funnel event names for the Funnel-by-Job piece detail
 * (FunnelPieceDetail — "did this piece do its job?"). Kept in its own module so
 * the component file only exports components (keeps react-refresh fast-refresh
 * working, per react-refresh/only-export-components) while tests import the names.
 *
 * Each value is a member of the `AlphaEventName` registry in
 * `src/lib/posthogClient.ts`, so emitting them is type-checked — no casts.
 */
export const FUNNEL_PIECE_EVENTS = {
  /** The detail opened (one per view). */
  VIEWED: 'v4_funnel_piece_viewed',
  /** "Update stored copy" tapped. */
  UPDATE_STORED: 'v4_funnel_piece_update_stored_clicked',
  /** "Get the design brief" tapped. */
  BRIEF: 'v4_funnel_piece_brief_clicked',
  /** "Open a test" tapped. */
  TEST: 'v4_funnel_piece_test_clicked',
  /** "Check an uploaded asset" tapped. */
  CHECK: 'v4_funnel_piece_check_clicked',
} as const;

export type FunnelPieceEvent = (typeof FUNNEL_PIECE_EVENTS)[keyof typeof FUNNEL_PIECE_EVENTS];
