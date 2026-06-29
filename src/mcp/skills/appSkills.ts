/**
 * App-skill loader — grounds the MCP coach surface in the IDEA Brand Coach
 * **App Skill Architecture** (Trevor Bradford, doc ref IDEA-APP-SKILLS-001 v1.0).
 *
 * This is the AUTHORITATIVE operational skill set: 20 skills across 4 tiers, living
 * under `skills/idea/app-skills/`. It supersedes all previous skill lists and is layered
 * on top of the book-decomposition corpus that `skillLoader.ts` reads — the app skills
 * cite the book corpus as source material; this module is about the operational spec.
 *
 * The machine-readable contract is `_manifest.json`; per-skill content is the markdown
 * files it references. Tool handlers append `appGroundingPreamble(<tool>)` to their
 * description so the agent applies the authoritative skills (and is reminded to keep
 * Tier 4 + the buyer-state taxonomy internal — never surfaced to the user).
 *
 * Server-side only (Node). No external deps: JSON.parse for the manifest, hand-parsed
 * markdown title for the body. Mirrors the resolution/caching shape of skillLoader.ts.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AppSkill {
  /** Two-digit skill number, "01".."20" (the stable key). */
  number: string;
  /** Skill name, e.g. "The Decision Trigger". */
  name: string;
  /** Tier 1..4. */
  tier: number;
  /** "Alpha" | "Beta". */
  scope: string;
  /** Shown to the user (false for the engine-only skills: 05 + the Tier-4 science skills). */
  userFacing: boolean;
  /** Internal-only — never named/cited/surfaced in user-facing output (05 + 15..20). */
  internalOnly: boolean;
  /** Tier-1 foundation skills loaded into context on every session (01..03). */
  alwaysInContext: boolean;
  /** Skill numbers this one depends on (pipeline ordering). */
  dependsOn: string[];
  /** Path relative to `skills/idea/app-skills/`. */
  file: string;
  /** Title from the leading `# SKILL — <title>` heading (falls back to `name`). */
  title: string;
  /** Content fidelity: "full" (Trevor's detailed doc) | "summary" (master-table purpose). */
  contentFidelity: string;
}

export interface AppArchitecture {
  docRef: string;
  governingPrinciple: string;
  totals: { skills: number; tiers: number };
  tiers: Array<{ tier: number; name: string; skills: string[]; function: string }>;
  hardRules: string[];
  scopeNote: string;
}

interface ManifestSkill {
  number: string;
  name: string;
  tier: number;
  scope: string;
  user_facing: boolean;
  internal_only: boolean;
  always_in_context: boolean;
  depends_on: string[];
  file: string;
  content_fidelity: string;
}
interface Manifest {
  doc_ref: string;
  governing_principle: string;
  totals: { skills: number; tiers: number };
  tiers: Array<{ tier: number; name: string; skills: string[]; function: string }>;
  hard_rules: string[];
  scope_note: string;
  skills: ManifestSkill[];
}

/**
 * Tool → app-skill numbers. A tool is grounded in the authoritative skills listed here
 * (the operational spec it must apply). Kept alongside skillLoader's book grounding —
 * a tool can cite both its book chapters and its app skills.
 */
const TOOL_APP_SKILLS: Record<string, string[]> = {
  // Free + enriched Trust Gap diagnostic → the score, the framework lens, the framing.
  run_trust_gap: ['06', '01', '03'],
  // Phase-2 corpus-enriched evidence → corpus analysis feeding the score.
  run_diagnostic_evidence: ['07', '06'],
  // Avatar 2.0 pipeline → forensic portrait + corpus + purchase motivation + buyer-state engine.
  build_avatar_stage: ['04', '07', '08', '05'],
  // Concept/asset generation → the trigger and the brief it produces.
  generate_concepts: ['09', '10'],
  // Design brief → the brief generator and the trigger it derives from.
  generate_brief: ['10', '09'],
  // Listing image-set brief → design-brief generator + trigger + avatar + trust gap + listing analysis.
  generate_listing_image_brief: ['10', '09', '04', '06', '12'],
  // Evidence-derived Trust Gap → the score skill, the framework lens, the commercial frame.
  assess_idea_dimensions: ['06', '01', '03'],
  // The single named Decision Trigger™ lever → the trigger skill + the score + the framework lens.
  identify_decision_trigger: ['09', '06', '01'],
  // Onboarding state + the warm single next step → the commercial frame, Trevor's voice, the lens.
  onboard_status: ['03', '02', '01'],
};

let cache: AppSkill[] | null = null;
let manifestCache: Manifest | null = null;

const MAX_CWD_WALK = 6;

function findAppSkillsDir(): string | null {
  const candidates: string[] = [];
  try {
    // appSkills.ts lives at <root>/src/mcp/skills/ → repo root is three up.
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(here, '../../../skills/idea/app-skills'));
  } catch {
    // import.meta unavailable (non-ESM context) — fall through to cwd walk.
  }
  let d = process.cwd();
  for (let i = 0; i < MAX_CWD_WALK; i++) {
    candidates.push(join(d, 'skills/idea/app-skills'));
    d = dirname(d);
  }
  return candidates.find((c) => existsSync(join(c, '_manifest.json'))) ?? null;
}

function loadManifest(): Manifest | null {
  if (manifestCache) return manifestCache;
  const dir = findAppSkillsDir();
  if (!dir) return null;
  try {
    manifestCache = JSON.parse(readFileSync(join(dir, '_manifest.json'), 'utf8')) as Manifest;
  } catch {
    manifestCache = null;
  }
  return manifestCache;
}

function titleFromBody(raw: string): string {
  const m = raw.match(/^#\s*SKILL\s*[—-]\s*(.+)$/m) ?? raw.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

/** Load and cache the 20 app skills from the manifest (+ each file's title). */
export function loadAppSkills(): AppSkill[] {
  if (cache) return cache;
  const dir = findAppSkillsDir();
  const manifest = loadManifest();
  if (!dir || !manifest) {
    cache = [];
    return cache;
  }
  cache = manifest.skills.map((s) => {
    let title = s.name;
    try {
      title = titleFromBody(readFileSync(join(dir, s.file), 'utf8')) || s.name;
    } catch {
      /* file unreadable — degrade to the manifest name, never throw */
    }
    return {
      number: s.number,
      name: s.name,
      tier: s.tier,
      scope: s.scope,
      userFacing: s.user_facing,
      internalOnly: s.internal_only,
      alwaysInContext: s.always_in_context,
      dependsOn: s.depends_on ?? [],
      file: s.file,
      title,
      contentFidelity: s.content_fidelity,
    };
  });
  return cache;
}

/** The architecture header (doc ref, tiers, hard rules) from the manifest. */
export function appArchitecture(): AppArchitecture | null {
  const m = loadManifest();
  if (!m) return null;
  return {
    docRef: m.doc_ref,
    governingPrinciple: m.governing_principle,
    totals: m.totals,
    tiers: m.tiers,
    hardRules: m.hard_rules,
    scopeNote: m.scope_note,
  };
}

/** All skills in a tier (1..4). */
export function appSkillsByTier(tier: number): AppSkill[] {
  return loadAppSkills().filter((s) => s.tier === tier);
}

/** Tier-1 foundation skills — loaded into context on every session (spec §5.1). */
export function tier1AlwaysInContext(): AppSkill[] {
  return loadAppSkills().filter((s) => s.alwaysInContext);
}

/** Engine-only skills (Skill 05 + Tier-4) — never surfaced to the user (spec §5.4). */
export function internalOnlySkills(): AppSkill[] {
  return loadAppSkills().filter((s) => s.internalOnly);
}

/** Skills whose output the user may see. */
export function userFacingAppSkills(): AppSkill[] {
  return loadAppSkills().filter((s) => s.userFacing);
}

/** One skill by number ("01".."20"). */
export function getAppSkill(number: string): AppSkill | undefined {
  return loadAppSkills().find((s) => s.number === number);
}

/** Raw markdown body of a skill by number (empty string if unreadable). */
export function appSkillContent(number: string): string {
  const dir = findAppSkillsDir();
  const skill = getAppSkill(number);
  if (!dir || !skill) return '';
  try {
    return readFileSync(join(dir, skill.file), 'utf8');
  } catch {
    return '';
  }
}

/** The skills that ground a given MCP tool (empty if the tool is unmapped). */
export function appSkillGrounding(toolName: string): AppSkill[] {
  const nums = TOOL_APP_SKILLS[toolName];
  if (!nums || nums.length === 0) return [];
  const byNum = new Map(loadAppSkills().map((s) => [s.number, s]));
  return nums.map((n) => byNum.get(n)).filter((s): s is AppSkill => Boolean(s));
}

/**
 * A bounded, model-facing citation appended to a grounded tool's description. Names the
 * authoritative app skills the tool must apply and reasserts the hard rule: keep the
 * science and the buyer-state taxonomy internal — never surface framework jargon or
 * buyer-state names in user-facing output. Empty string for unmapped tools (no-op append).
 */
export function appGroundingPreamble(toolName: string): string {
  const skills = appSkillGrounding(toolName);
  if (skills.length === 0) return '';
  const cited = skills.map((s) => `${s.number} ${s.name}`).join('; ');
  return (
    ' Grounded in the IDEA Brand Coach App Skill Architecture (IDEA-APP-SKILLS-001 v1.0) — apply skills: ' +
    cited +
    '. Per the terminology policy (IDEA-POLICY-TERM-001): always use the Tier A commercial terms (Trust Gap™, Decision Trigger™, the four pillar names); keep the buyer-state taxonomy (Assessor/Protector/Expresser/Connector) out of primary output panels — opt-in expansion only; never surface Tier C engine internals (neuroanatomy, S1-S4 labels, field names) or confidence scores in user-facing output.'
  );
}

/** Test/maintenance helper: the configured tool→app-skill map. */
export function groundedAppToolNames(): string[] {
  return Object.keys(TOOL_APP_SKILLS);
}
