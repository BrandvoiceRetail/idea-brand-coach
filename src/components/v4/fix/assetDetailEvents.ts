/**
 * PostHog funnel event names for the Loop-3 per-asset working surface
 * (AssetDetailTabs). Lives in its own module so the component file only exports
 * components — keeps react-refresh fast-refresh working (see
 * react-refresh/only-export-components) while tests can still import the names.
 */
export const ASSET_DETAIL_EVENTS = {
  TAB_VIEWED: 'v4_asset_detail_tab_viewed',
  CHECK_RUN: 'v4_asset_check_run',
  VERDICT_RECORDED: 'v4_asset_verdict_recorded',
} as const;

export type AssetDetailEvent = (typeof ASSET_DETAIL_EVENTS)[keyof typeof ASSET_DETAIL_EVENTS];
