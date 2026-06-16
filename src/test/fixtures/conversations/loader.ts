/**
 * Golden-conversation fixture loader for the Brand-Coach MCP test corpus.
 *
 * Each fixture is a Markdown golden transcript with YAML front-matter (the matrix row),
 * inline ⟦tool: …⟧ / ⟦skill: …⟧ / ⟦iv-os: …⟧ provenance tags, an `### Artifact produced`
 * block, and an `### Assertions (oracle …)` block. See
 * `_bmad-output/test-artifacts/test-design/brand-coach-mcp-test-design.md` for the format.
 *
 * Used by `src/test/integration/mcp-conversation-replay.test.ts`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONV_DIR = dirname(fileURLToPath(import.meta.url));

export interface Fixture {
  tc_id: string;
  layer?: string;
  persona?: string;
  tools: string[];
  skills: string[];
  book_ref: string[];
  type?: string;
  priority?: string;
  status?: string;
  file: string;
  relFile: string;
  body: string;
  toolTags: string[];
  skillTags: string[];
  ivosTags: string[];
  assertions: string[];
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

/** Minimal front-matter parser: scalars + `[a, b]` arrays, including multi-line bracketed arrays. */
function parseFrontMatter(text: string): Record<string, string | string[]> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const fm: Record<string, string | string[]> = {};
  if (!m) return fm;
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val: string = kv[2].trim();
    if (val.startsWith('[') && !val.endsWith(']')) {
      // multi-line array: accumulate until the closing ]
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

function tags(body: string, kind: 'tool' | 'skill' | 'iv-os'): string[] {
  const re = new RegExp(`⟦${kind}:\\s*([^⟧]+)⟧`, 'g');
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) set.add(m[1].trim());
  return [...set];
}

function assertionLines(body: string): string[] {
  const sec = body.split(/### Assertions[^\n]*\n/)[1];
  if (!sec) return [];
  return sec
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- ['));
}

function asArr(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export function loadFixtures(): Fixture[] {
  return walk(CONV_DIR).map((file) => {
    const body = readFileSync(file, 'utf8');
    const fm = parseFrontMatter(body);
    return {
      tc_id: (fm.tc_id as string) ?? '',
      layer: fm.layer as string,
      persona: fm.persona as string,
      tools: asArr(fm.tools),
      skills: asArr(fm.skills),
      book_ref: asArr(fm.book_ref),
      type: fm.type as string,
      priority: fm.priority as string,
      status: fm.status as string,
      file,
      relFile: relative(CONV_DIR, file),
      body,
      toolTags: tags(body, 'tool'),
      skillTags: tags(body, 'skill'),
      ivosTags: tags(body, 'iv-os'),
      assertions: assertionLines(body),
    };
  });
}

/** Tools that are infra/substrate and need not appear as inline ⟦tool:⟧ tags in a transcript. */
export const NON_CONVERSATIONAL_TOOLS = new Set(['mcp_host_gateway', 'ivos_consumption_client']);
