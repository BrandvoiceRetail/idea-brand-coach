/**
 * /v4 route namespace + spine configuration.
 *
 * NOTE: the surface force-flag that used to live here (`isV4Forced()` /
 * `VITE_FORCE_V4`) has been RETIRED in favour of the version-agnostic release
 * stage in `src/config/releaseStage.ts` (`isPreGa()` — pre-GA forces the single
 * customer surface). This file now owns only the `/v4` route namespace and spine.
 *
 * - `V4_SPINE` is the canonical Diagnose → Analyse → Fix → Re-measure → Defend
 *   spine rendered by the sticky stepper, the desktop sidebar, and the mobile
 *   bottom-nav. One definition, three surfaces — no drift.
 */
import {
  Stethoscope,
  Microscope,
  Wrench,
  Gauge,
  Shield,
  type LucideIcon,
} from 'lucide-react';

/** The /v4 route namespace. Old /v1 /v2 /v3 routes remain mounted alongside. */
export const V4_ROUTES = {
  /** Loop-1 onboarding entry (megaprompt paste → read-it-back → context card). */
  ROOT: '/v4',
  /**
   * Post-signup onboarding CHOICE screen — strongly steers to the connector
   * (primary) with a quiet "set up in the app" link to ROOT (secondary).
   */
  CHOICE: '/v4/start',
  /**
   * Connector setup guide (add the Brand Coach connector + Windsor + pasteable
   * prompts) — the primary, recommended onboarding path from CHOICE.
   */
  CONNECTOR: '/v4/connect',
  DIAGNOSE: '/v4/diagnose',
  ANALYSE: '/v4/analyse',
  FIX: '/v4/fix',
  REMEASURE: '/v4/remeasure',
  DEFEND: '/v4/defend',
} as const;

export type V4RouteKey = keyof typeof V4_ROUTES;

/** A single stage of the brand-systems spine. */
export interface SpineStage {
  /** Stable key (used for stepper state + analytics). */
  key: 'diagnose' | 'analyse' | 'fix' | 'remeasure' | 'defend';
  /** Short label shown in the sidebar / bottom-nav. */
  label: string;
  /** One-line description of what the stage does. */
  blurb: string;
  /** Route the stage links to. */
  path: string;
  /** Lucide icon for the nav surfaces. */
  icon: LucideIcon;
  /**
   * IDEA-dimension token used to tint the stage marker
   * (maps to --idea-* / --gold-warm CSS vars from the v23 palette).
   */
  tone: 'idea-i' | 'idea-d' | 'idea-e' | 'idea-a' | 'gold-warm';
}

/** The canonical spine — Diagnose → Analyse → Fix → Re-measure → Defend. */
export const V4_SPINE: readonly SpineStage[] = [
  {
    key: 'diagnose',
    label: 'Diagnose',
    blurb: 'Find your Trust Gap',
    path: V4_ROUTES.DIAGNOSE,
    icon: Stethoscope,
    tone: 'idea-e',
  },
  {
    key: 'analyse',
    label: 'Analyse',
    blurb: 'Avatar + Decision Trigger',
    path: V4_ROUTES.ANALYSE,
    icon: Microscope,
    tone: 'idea-i',
  },
  {
    key: 'fix',
    label: 'Fix',
    blurb: 'Positioning + design brief',
    path: V4_ROUTES.FIX,
    icon: Wrench,
    tone: 'idea-a',
  },
  {
    key: 'remeasure',
    label: 'Re-measure',
    blurb: 'Lift on the numbers',
    path: V4_ROUTES.REMEASURE,
    icon: Gauge,
    tone: 'gold-warm',
  },
  {
    key: 'defend',
    label: 'Defend',
    blurb: 'Hold the gains',
    path: V4_ROUTES.DEFEND,
    icon: Shield,
    tone: 'idea-d',
  },
] as const;

/** Resolve the active spine stage for a pathname (null on the onboarding root). */
export function activeStageFor(pathname: string): SpineStage | null {
  return V4_SPINE.find((s) => pathname.startsWith(s.path)) ?? null;
}

/**
 * localStorage key recording that a user has been shown the post-signup
 * onboarding CHOICE screen at least once. Decoupled from the v1/v2 version
 * preference so the connector-onboarding fork has its own first-run signal.
 */
const V4_ONBOARDING_SEEN_KEY = 'idea_v4_onboarding_seen';

/** Whether this device has already shown the V4 onboarding CHOICE screen. */
export function hasSeenV4Onboarding(): boolean {
  try {
    return localStorage.getItem(V4_ONBOARDING_SEEN_KEY) === 'true';
  } catch {
    // localStorage unavailable — treat as not-seen so the user still gets the
    // choice rather than being silently dropped past it.
    return false;
  }
}

/** Mark the V4 onboarding CHOICE screen as seen (called once the user picks a path). */
export function markV4OnboardingSeen(): void {
  try {
    localStorage.setItem(V4_ONBOARDING_SEEN_KEY, 'true');
  } catch {
    // localStorage full/unavailable — fail silently; worst case the user sees
    // the choice screen again next session.
  }
}
