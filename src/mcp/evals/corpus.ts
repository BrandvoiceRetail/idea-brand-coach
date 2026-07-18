/**
 * Eval corpus adapter — reads the golden conversation fixtures the live-replay harness
 * uses (src/test/fixtures/conversations) and derives the structured facts the metrics
 * score. Production code under src/mcp deliberately does NOT import the test-side loader;
 * it reads the same markdown so the eval engine type-checks under tsconfig.mcp.json alone.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CorpusFixture {
  tcId: string;
  persona: string;
  type: string;
  layer: string;
  journey: string;
  tools: string[];
  skills: string[];
  oracleDims: string[];
  hasArtifact: boolean;
  hasActionableArtifact: boolean;
}

const MAX_CWD_WALK = 6;
const REL = 'src/test/fixtures/conversations';

function findCorpusDir(): string | null {
  const candidates: string[] = [];
  try {
    // corpus.ts lives at <root>/src/mcp/evals → corpus is <root>/src/test/fixtures/conversations
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(here, '../../test/fixtures/conversations'));
  } catch {
    /* import.meta unavailable — fall through to cwd walk */
  }
  let d = process.cwd();
  for (let i = 0; i < MAX_CWD_WALK; i++) {
    candidates.push(join(d, REL));
    d = dirname(d);
  }
  return candidates.find((c) => existsSync(c)) ?? null;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.md') && name !== 'README.md') out.push(full);
  }
  return out;
}

/** Minimal front-matter parser: scalars + `[a, b]` arrays (incl. multi-line bracketed). */
function parseFrontMatter(text: string): Record<string, string | string[]> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const fm: Record<string, string | string[]> = {};
  if (!m) return fm;
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if (val.startsWith('[') && !val.endsWith(']')) {
      while (i + 1 < lines.length && !val.endsWith(']')) {
        i++;
        val += ' ' + lines[i].trim();
      }
    }
    if (val.startsWith('[') && val.endsWith(']')) {
      fm[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      fm[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return fm;
}

function asArr(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/** Oracle dimension tags inside the `### Assertions` block, e.g. `- [skill-faithful] …`. */
function oracleDims(body: string): string[] {
  const sec = body.split(/### Assertions[^\n]*\n/)[1];
  if (!sec) return [];
  const dims = new Set<string>();
  const re = /^- \[([a-z-]+)(?::[^\]]+)?\]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sec))) dims.add(m[1]);
  return [...dims];
}

/** Actionable deliverables a coaching session can end on (Trevor's governing promise). */
const ACTIONABLE = /\b(trust gap score|decision trigger|brief|a\/b test|design test|draft|positioning_statement|canvas|strategy doc|score|trigger)\b/i;

export function loadCorpus(): CorpusFixture[] {
  const dir = findCorpusDir();
  if (!dir) return [];
  return walk(dir).map((file) => {
    const body = readFileSync(file, 'utf8');
    const fm = parseFrontMatter(body);
    const rel = relative(dir, file);
    const artifactSec = body.split(/### Artifact produced/)[1]?.split(/### Assertions/)[0] ?? '';
    return {
      tcId: (fm.tc_id as string) ?? rel,
      persona: (fm.persona as string) ?? '?',
      type: (fm.type as string) ?? '?',
      layer: (fm.layer as string) ?? '?',
      journey: rel.split(/[\\/]/)[0],
      tools: asArr(fm.tools),
      skills: asArr(fm.skills),
      oracleDims: oracleDims(body),
      hasArtifact: artifactSec.trim().length > 0,
      hasActionableArtifact: ACTIONABLE.test(artifactSec),
    };
  });
}

/** Distinct tool labels referenced across the corpus front-matter. */
export function corpusToolLabels(fx: CorpusFixture[]): Set<string> {
  return new Set(fx.flatMap((f) => f.tools));
}

/** Distinct skill paths cited across the corpus front-matter. */
export function corpusSkillPaths(fx: CorpusFixture[]): Set<string> {
  return new Set(fx.flatMap((f) => f.skills));
}
