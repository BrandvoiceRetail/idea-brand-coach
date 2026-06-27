/**
 * PostHog funnel event names for the Funnel-by-Job MAP (FunnelMap — "is each
 * piece doing its job?"). Kept in its own module so the component file only
 * exports components (keeps react-refresh fast-refresh working, per
 * react-refresh/only-export-components) while tests import the names.
 *
 * Each value is a member of the `AlphaEventName` registry in
 * `src/lib/posthogClient.ts`, so emitting them is type-checked — no casts.
 */
export const FUNNEL_MAP_EVENTS = {
  /** A real map was shown (fires once per populated view). */
  VIEWED: 'v4_funnel_map_viewed',
  /** A funnel piece card opened. */
  PIECE_OPENED: 'v4_funnel_asset_opened',
  /** Read failed → user tapped retry. */
  RETRY: 'v4_funnel_map_retry',
  /** "Add piece" tapped. */
  ADD_PIECE: 'v4_funnel_add_piece_clicked',
  /** A channel filter chip toggled. */
  CHANNEL_FILTERED: 'v4_funnel_channel_filtered',
  /** The avatar scope changed from the toolbar (re-scopes the whole funnel). */
  AVATAR_CHANGED: 'v4_funnel_avatar_changed',
  /** The marketplace scope changed from the toolbar. */
  MARKETPLACE_CHANGED: 'v4_funnel_marketplace_changed',
  /** The metric range changed from the toolbar (drives the piece-metrics window). */
  RANGE_CHANGED: 'v4_funnel_range_changed',
} as const;

export type FunnelMapEvent = (typeof FUNNEL_MAP_EVENTS)[keyof typeof FUNNEL_MAP_EVENTS];
