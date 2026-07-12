/**
 * Layer 1 — `refine_creative_plan` director.
 *
 * The UPDATE path for every creative plan (listing image set, video storyboard, A+
 * content, main image + title, storefront messaging, UGC ad). Two change classes:
 *
 *  - COMPONENT change ("swap scene 3's setting", "new benefits line on slot 3"):
 *    surgical — recompose ONLY the named component, keep everything approved verbatim,
 *    re-run one generation (or a Higgsfield edit tool), reconcile the saved asset.
 *
 *  - POSITIONING change (new trigger / avatar core / signature / trust finding /
 *    corrected fact): propagates — the deterministic POSITIONING_PROPAGATION map says
 *    exactly what each surface must recompose, for the plan in hand AND for the user's
 *    OTHER live plans, so one positioning story stays true everywhere.
 *
 * Grounding-director: returns the filtered propagation + the surgical protocol; the
 * connector coach fetches the saved plan, recomposes the named parts, and re-executes
 * only what changed. It never regenerates wholesale and never invents a claim.
 */
import {
  CREATIVE_PLAN_TYPES,
  HIGGSFIELD_HANDOFF,
  POSITIONING_PROPAGATION,
  POSITIONING_SPINE,
  TIER_C_NEVER_CONTAIN,
  type CreativePlanType,
  type PositioningElementKey,
} from './creativeAlignment.js';

export interface RefineCreativePlanInput {
  /** Which plan the user wants to change. */
  planType: CreativePlanType;
  /** The user's change request, in their words. */
  changeRequest: string;
  /** Positioning elements that changed (empty/absent = a component-level change). */
  positioningChanges?: PositioningElementKey[];
  /** The saved plan's ledger asset id, when known (else the coach looks it up / asks). */
  assetId?: string;
}

export interface PropagationEntry {
  element: PositioningElementKey;
  label: string;
  /** What THIS plan must recompose. */
  this_plan: string;
  /** What each OTHER surface must recompose — the stale-asset sweep. */
  other_plans: Partial<Record<CreativePlanType, string>>;
}

export interface RefineCreativePlanResult {
  ok: true;
  plan_type: CreativePlanType;
  change_scope: 'component' | 'positioning';
  /** Positioning changes only: the filtered propagation map. */
  propagation: PropagationEntry[];
  /** The surgical recompose protocol (both scopes). */
  surgical_protocol: readonly string[];
  /** Cheap-edit routing before any regeneration. */
  higgsfield_edit_tools: string;
  save_back: readonly string[];
  never_contain: readonly string[];
  instructions: string[];
  summary: string;
}

/** The surgical protocol every refinement follows, regardless of scope. */
export const SURGICAL_PROTOCOL: readonly string[] = [
  'START FROM THE SAVED PLAN: fetch it with get_asset (or list_assets to find it; ask the user to paste it only if it was never saved). Never rebuild a plan from memory — the saved version is what is live.',
  'Name the components that change; everything else is APPROVED and stays verbatim — copy, prompts, continuity anchors, palette. The user already signed off on it.',
  'Recompose ONLY the named components, keeping each plan\'s continuity anchors intact (storyboard: palette/lighting/VO register; image set: the set-wide style; storefront: the tagline system).',
  'Re-run the claim gate on changed COPY only — an unchanged approved line does not re-open the gate.',
  'Re-execute only what changed: one storyboard panel edit + one video job, one slot\'s image, one section\'s banner — never the whole set.',
  'If the change alters what a live split-test was testing, update the test (design_test / update_test_milestone) so the measurement stays honest.',
];

export const SAVE_BACK: readonly string[] = [
  'Save the updated plan with log_asset using the SAME external_id as the original — the ledger reconciles it as a new version instead of duplicating.',
  'Flip statuses with update_asset_status as revised pieces move draft → in_review → approved.',
  'If other plans were flagged stale by the propagation, offer to refine each — same protocol, one surface at a time.',
];

/** Build the refinement direction for a requested change. */
export function buildCreativePlanRefinement(input: RefineCreativePlanInput): RefineCreativePlanResult {
  const changes = (input.positioningChanges ?? []).filter(
    (c, i, arr) => POSITIONING_PROPAGATION[c] !== undefined && arr.indexOf(c) === i,
  );
  const scope: 'component' | 'positioning' = changes.length > 0 ? 'positioning' : 'component';
  const labelByKey = new Map(POSITIONING_SPINE.map((el) => [el.key, el.label]));

  const propagation: PropagationEntry[] = changes.map((element) => {
    const row = POSITIONING_PROPAGATION[element];
    const others: Partial<Record<CreativePlanType, string>> = {};
    for (const planType of CREATIVE_PLAN_TYPES) {
      if (planType !== input.planType) others[planType] = row[planType];
    }
    return {
      element,
      label: labelByKey.get(element) ?? element,
      this_plan: row[input.planType],
      other_plans: others,
    };
  });

  const instructions =
    scope === 'positioning'
      ? [
          `1) Fetch the saved ${input.planType} plan (get_asset${input.assetId ? ` id ${input.assetId}` : ' — find it via list_assets'}).`,
          '2) For each changed positioning element, recompose exactly what propagation.this_plan names — nothing else moves. Approved components stay verbatim.',
          '3) Re-run the claim gate on recomposed copy; re-execute only the affected generations (prefer the Higgsfield edit tools for mechanical parts).',
          '4) Sweep for staleness: list_assets for the user\'s other live plans and flag each one whose propagation.other_plans entry applies — offer to update them so every surface tells the same story.',
          '5) Save back per save_back (same external_id → reconciled version) and true-up any live split-test.',
        ]
      : [
          `1) Fetch the saved ${input.planType} plan (get_asset${input.assetId ? ` id ${input.assetId}` : ' — find it via list_assets'}).`,
          `2) Map the request — "${input.changeRequest}" — to the plan's named components (a scene/panel, a slot, a beat, a section, a title segment). Confirm the mapping with the user if ambiguous.`,
          '3) Apply surgical_protocol: recompose only those components, keep continuity anchors, claim-gate changed copy, and re-execute one job (or one Higgsfield edit-tool call) per changed component.',
          '4) If the change is really a positioning shift in disguise (a new angle, a new line everywhere), re-call refine_creative_plan with positioning_changes set so the propagation map runs.',
          '5) Save back per save_back (same external_id → reconciled version) and true-up any live split-test.',
        ];

  return {
    ok: true,
    plan_type: input.planType,
    change_scope: scope,
    propagation,
    surgical_protocol: SURGICAL_PROTOCOL,
    higgsfield_edit_tools: HIGGSFIELD_HANDOFF.edit_tools,
    save_back: SAVE_BACK,
    never_contain: TIER_C_NEVER_CONTAIN,
    instructions,
    summary:
      scope === 'positioning'
        ? `Positioning refinement of the ${input.planType} plan (${changes.map((c) => labelByKey.get(c) ?? c).join(', ')} changed): recompose exactly what the propagation map names on this plan, sweep the user's other live plans for staleness, keep everything approved verbatim, re-execute only what changed, and reconcile the saved version.`
        : `Component refinement of the ${input.planType} plan ("${input.changeRequest}"): map the request to named components, recompose only those (continuity anchors intact, claim gate on changed copy), re-run one generation or one Higgsfield edit-tool call per component, and reconcile the saved version.`,
  };
}
