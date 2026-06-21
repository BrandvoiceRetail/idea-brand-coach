/**
 * Coach configurations — the things the eval suite compares.
 *
 * A configuration = which skill layer(s) ground the MCP tools. The three configs
 * isolate the contribution of the book corpus vs the App Skill Architecture vs both:
 *   - book   : tools grounded only in the 158-skill book corpus (skillLoader).
 *   - app    : tools grounded only in the 20-skill App Skill Architecture (appSkills).
 *   - both   : both layers — what the live coach actually runs today.
 *
 * Everything here reads the SAME registries the live tools use, so the comparison
 * reflects reality, not a parallel model.
 */
import {
  groundedToolNames,
  toolSkillGrounding,
  loadIdeaSkills,
} from '../skills/skillLoader.js';
import {
  groundedAppToolNames,
  appSkillGrounding,
  appGroundingPreamble,
  loadAppSkills,
} from '../skills/appSkills.js';
import type { GroundingSource } from './types.js';

export interface ConfigDef {
  id: string;
  label: string;
  description: string;
  groundingSource: GroundingSource;
  current: boolean;
}

export const CONFIGS: ConfigDef[] = [
  {
    id: 'book-grounding',
    label: 'Book grounding (baseline)',
    description:
      'Tools grounded only in the 158-skill book corpus (skills/idea/framework). The pre-existing baseline before the App Skill Architecture.',
    groundingSource: 'book',
    current: false,
  },
  {
    id: 'app-skills',
    label: 'App Skill Architecture only',
    description:
      'Tools grounded only in the 20-skill App Skill Architecture (IDEA-APP-SKILLS-001 v1.0) — the operational spec without the book knowledge corpus underneath.',
    groundingSource: 'app',
    current: false,
  },
  {
    id: 'app+book',
    label: 'App Skills + Book (current)',
    description:
      'Tools grounded in both layers — the operational App Skill Architecture over the book knowledge corpus. This is the configuration the live coach runs.',
    groundingSource: 'both',
    current: true,
  },
];

export const CURRENT_CONFIG_ID = CONFIGS.find((c) => c.current)!.id;

/** tool name → number of grounding skills, for a grounding source. */
export function groundedToolMap(src: GroundingSource): Record<string, number> {
  const book: Record<string, number> = {};
  for (const t of groundedToolNames()) book[t] = toolSkillGrounding(t).length;
  const app: Record<string, number> = {};
  for (const t of groundedAppToolNames()) app[t] = appSkillGrounding(t).length;

  if (src === 'book') return book;
  if (src === 'app') return app;
  // both: union of tool names, skill counts summed
  const out: Record<string, number> = { ...book };
  for (const [t, n] of Object.entries(app)) out[t] = (out[t] ?? 0) + n;
  return out;
}

/**
 * The set of skill identifiers a config can resolve. Book skills are keyed by their
 * corpus path (`idea/framework/<relPath>`) — the same form the golden fixtures cite —
 * so skill-resolution against the corpus is a real comparison.
 */
export function configSkillPaths(src: GroundingSource): Set<string> {
  const book = loadIdeaSkills().map((s) => `idea/framework/${s.relPath}`);
  const app = loadAppSkills().map((s) => `idea/app-skills/${s.file}`);
  if (src === 'book') return new Set(book);
  if (src === 'app') return new Set(app);
  return new Set([...book, ...app]);
}

/** Whether a config injects the hard-rule guardrail into its grounded tool descriptions. */
export function injectsGuardrails(src: GroundingSource): boolean {
  if (src === 'book') return false; // book grounding cites chapters only, no hard-rule reassertion
  // app / both: the app grounding preamble reasserts the buyer-state internal rule.
  const sample = groundedAppToolNames()[0];
  const pre = sample ? appGroundingPreamble(sample) : '';
  return /internal/i.test(pre) && /Assessor|Protector|Expresser|Connector/i.test(pre);
}
