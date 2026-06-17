/**
 * Skill loader — grounds the MCP coach surface in the IDEA-book skill library.
 *
 * Reads the atomic skills under `skills/idea/framework/**` (authored from Trevor
 * Bradford's "What Captures the Heart Goes in the Cart") and maps MCP tools to the
 * book sections that power them (the traceability spine: book § → skill → tool).
 * Tool handlers append `groundingPreamble(<tool>)` to their description so the agent
 * sees which source material the tool is grounded in — and is told to stay within it.
 *
 * Server-side only (Node). No external deps: front-matter is parsed by hand.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface IdeaSkill {
  /** Path relative to `skills/idea/framework/` (the stable traceability key). */
  relPath: string;
  /** Book chapter, from front-matter (e.g. "2 — IDEA: A Framework for Building Trust"). */
  chapter: string;
  /** Book section, from front-matter. */
  section: string;
  /** Source pages, from front-matter. */
  sourcePages: string;
  /** Skill type, from front-matter (framework | reference | tactic | …). */
  type: string;
  /** Skill title, from the leading `# SKILL — <title>` heading. */
  title: string;
}

/**
 * Tool → framework path-prefixes. A tool is grounded in every skill whose relPath
 * starts with one of its prefixes. Prefix mapping (not file enumeration) so new
 * skills under a section are picked up automatically.
 */
const TOOL_SKILL_PREFIXES: Record<string, string[]> = {
  // Diagnostics → the IDEA framework + four pillars + emotional triggers (Ch2).
  run_trust_gap: ['00-foundations/02-idea-framework'],
  run_diagnostic_evidence: ['00-foundations/02-idea-framework'],
  // Avatar pipeline → Avatar 2.0 forensic method (Ch3).
  build_avatar_stage: ['01-customer/00-avatar-2.0'],
  // Concept/asset generation → the concept-driving brand sections specifically
  // (Ch6 brand voice + Ch4 authentically-human), not the whole 02-brand tree —
  // a coarse "grounded in 36 skills" citation is too weak to steer the model.
  generate_concepts: ['02-brand/02-brand-voice', '02-brand/00-authentically-human'],
};

let cache: IdeaSkill[] | null = null;

/** How many parent dirs to walk from cwd when import.meta resolution fails —
 *  covers running from repo root or a worktree a few levels deep. */
const MAX_CWD_WALK = 6;

function findFrameworkDir(): string | null {
  const candidates: string[] = [];
  try {
    // skillLoader.ts lives at <root>/src/mcp/skills/ → repo root is three up.
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(here, '../../../skills/idea/framework'));
  } catch {
    // import.meta unavailable (non-ESM context) — fall through to cwd walk.
  }
  let d = process.cwd();
  for (let i = 0; i < MAX_CWD_WALK; i++) {
    candidates.push(join(d, 'skills/idea/framework'));
    d = dirname(d);
  }
  return candidates.find((c) => existsSync(c)) ?? null;
}

/**
 * Parse the skill's front-matter. Contract: scalar `key: value` lines only
 * (keys are [A-Za-z_-]+) between the leading `---` fences — lists / block
 * scalars / nested YAML are not supported (the corpus is authored to this shape;
 * unmatched keys degrade to empty-string fields, never throw).
 */
function parseFrontMatter(raw: string): Record<string, string> {
  if (!raw.startsWith('---')) return {};
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return {};
  const fm: Record<string, string> = {};
  for (const line of raw.slice(3, end).split('\n')) {
    const m = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

function titleFromBody(raw: string): string {
  const m = raw.match(/^#\s*SKILL\s*[—-]\s*(.+)$/m) ?? raw.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

function walk(dir: string, base: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
}

/** Load and cache every authored skill under skills/idea/framework. */
export function loadIdeaSkills(): IdeaSkill[] {
  if (cache) return cache;
  const root = findFrameworkDir();
  if (!root) {
    cache = [];
    return cache;
  }
  const files: string[] = [];
  walk(root, root, files);
  cache = files.map((abs) => {
    const raw = readFileSync(abs, 'utf8');
    const fm = parseFrontMatter(raw);
    return {
      relPath: abs.slice(root.length + 1),
      chapter: fm.chapter ?? '',
      section: fm.section ?? '',
      sourcePages: fm.source_pages ?? '',
      type: fm.type ?? '',
      title: titleFromBody(raw),
    };
  });
  return cache;
}

/** The skills that ground a given MCP tool (empty if the tool is unmapped). */
export function toolSkillGrounding(toolName: string): IdeaSkill[] {
  const prefixes = TOOL_SKILL_PREFIXES[toolName];
  if (!prefixes || prefixes.length === 0) return [];
  return loadIdeaSkills().filter((s) =>
    prefixes.some((p) => s.relPath.startsWith(p)),
  );
}

/**
 * A bounded, model-facing citation appended to a grounded tool's description.
 * Cites the distinct book chapters the tool draws on and instructs the agent to
 * stay within that source. Empty string for unmapped tools (no-op append).
 */
export function groundingPreamble(toolName: string): string {
  const skills = toolSkillGrounding(toolName);
  if (skills.length === 0) return '';
  const chapters = [...new Set(skills.map((s) => s.chapter).filter(Boolean))].slice(0, 4);
  return (
    ' Grounded in the IDEA framework book "What Captures the Heart Goes in the Cart" — ' +
    chapters.join('; ') +
    `. Apply this source material (${skills.length} skills); do not invent guidance beyond it.`
  );
}

/** Test/maintenance helper: the configured tool→prefix map. */
export function groundedToolNames(): string[] {
  return Object.keys(TOOL_SKILL_PREFIXES);
}
