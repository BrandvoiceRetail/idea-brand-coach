/**
 * Loop-5 (Defend / "hold the gains") shared domain types.
 *
 * WHAT: The single contract the Defend screens (DriftWatchCard, DefendChecklist,
 * CompetitorTeaserCard, WorkbookExportCard) and the `defendService` seam import —
 * a Signature-drift watch (real `DriftItem[]` reused from Loop-3 Fix), a
 * deterministic defend checklist derived from real loop signals, and the
 * full-loop workbook export result.
 *
 * WHY: Defend is the Diagnose→Analyse→Fix→Re-measure→Defend spine's "keep what
 * you won" leg — watch for the brand drifting back open and file the proof.
 * Defining the contract once keeps the screens and the integrator from drifting
 * on field names.
 *
 * NO FABRICATION: every value is grounded.
 *  - Drift is the real `getDrift` read from Loop-3 (assets aligned to an older
 *    Signature) — never a made-up count.
 *  - The checklist `state` is computed from real reads (drift count, whether a
 *    second diagnostic run exists to confirm the lift); the competitor item is
 *    honestly `coming` because competitor reads are deferred in Alpha — it is
 *    NEVER shown as done/attention against invented competitor data.
 *  - The workbook export calls the live `export_workbook` engine; until that
 *    surface is wired it degrades to an honest error/needs_input, never a fake
 *    download.
 *
 * The result discriminant mirrors `FixResult`/`RemeasureResult` (same
 * ok | needs_input | error shape) so the service seams share one mental model.
 */
import type { NeedsInputItem } from '@/types/onboardingReflection';
import type { DriftItem } from '@/types/v4Fix';

/** Re-export so screens import the drift + grounding-demand shapes from one place. */
export type { DriftItem, NeedsInputItem };

// ── Defend checklist (deterministic, derived from real loop signals) ────────────

/**
 * The lifecycle state of a defend checklist item.
 * - `done`      — a real signal confirms it (e.g. zero drift, lift confirmed).
 * - `attention` — a real signal says it needs work (e.g. assets drifted).
 * - `pending`   — not yet established (no signal either way); an honest neutral.
 * - `coming`    — deferred in Alpha (e.g. competitor monitoring); honestly not live.
 */
export type ChecklistState = 'done' | 'attention' | 'pending' | 'coming';

/** Stable keys for the defend checklist (analytics + render keys). */
export type ChecklistKey = 'lift' | 'drift' | 'competitor' | 'workbook';

/** One row of the defend checklist — label + honest derived state + detail. */
export interface DefendChecklistItem {
  key: ChecklistKey;
  /** Everyday Tier-A label. */
  label: string;
  /** One-line plain-language detail explaining the current state. */
  detail: string;
  state: ChecklistState;
}

/** The Signature-drift watch surfaced on Defend. */
export interface DriftWatch {
  /** Assets aligned to an older Signature (real `getDrift` read). */
  items: DriftItem[];
  /** Convenience count (= items.length). */
  count: number;
}

/**
 * The full Defend status view: the drift watch, whether the lift was confirmed
 * (a second real diagnostic run exists), and the derived checklist. Every field
 * is grounded — no fabricated counts or states.
 */
export interface DefendStatus {
  drift: DriftWatch;
  /** True when a real before/after Trust Gap lift could be computed. */
  liftConfirmed: boolean;
  checklist: DefendChecklistItem[];
}

// ── Workbook export (live export_workbook engine) ───────────────────────────────

/**
 * The result of a full-loop workbook export. `downloadUrl` is null when the
 * engine returned a file it could not surface as a link (the caller shows the
 * `note` instead) — a link is NEVER fabricated.
 */
export interface WorkbookExport {
  /** Plain-language confirmation/footer from the export engine. */
  note: string;
  /** A real download URL when the engine provided one; null otherwise. */
  downloadUrl: string | null;
}

// ── Service result discriminant (no-fabrication seam) ──────────────────────────

/**
 * The discriminated result every `defendService` method returns. `ok` carries
 * real data; `needs_input` carries the grounding demand (ask the user — e.g. no
 * avatar yet); `error` carries a message. The service NEVER synthesises data to
 * avoid `needs_input` or `error` — honest degradation over fabrication.
 */
export type DefendResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'needs_input'; needs_input: NeedsInputItem[] }
  | { status: 'error'; error: string };
