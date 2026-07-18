/**
 * build-tool-registry.ts — generator for the /v4/tools trust-signals page.
 *
 * SINGLE SOURCE OF TRUTH for the tool list/descriptions is the MCP server's tool
 * files (each `server.registerTool(...)` / `registerAppTool(...)` call carries the
 * canonical name + title + description). We parse those rather than hand-maintain a
 * list, and we derive each tool's "first shipped" date + revision count from git
 * history of the file that owns it — so the registry stays accurate as the surface
 * evolves.
 *
 * Outputs (both regeneratable, never hand-edited):
 *   - src/data/toolRegistry.generated.ts  → typed data consumed by the React /v4/tools page
 *   - public/tool-registry.html           → standalone static trust-signals page
 *
 * Run:  (from the v4-surface worktree)
 *   node -e "const e=require('esbuild');eval(e.buildSync({entryPoints:['scripts/build-tool-registry.ts'],bundle:false,platform:'node',format:'cjs',write:false}).outputFiles[0].text)"
 * or simply `npm run build:tool-registry` if wired.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths — the MCP worktree owns the tool files; this worktree owns the outputs.
// ---------------------------------------------------------------------------
const HERE = dirname(fileURLToPath(import.meta.url));
const V4_ROOT = resolve(HERE, '..');
const MCP_WORKTREE =
  process.env.MCP_WORKTREE ??
  resolve(
    V4_ROOT,
    '..',
    'mcp-analytics',
  );
const TOOLS_DIR = join(MCP_WORKTREE, 'src', 'mcp', 'tools');

const DATA_OUT = join(V4_ROOT, 'src', 'data', 'toolRegistry.generated.ts');
const HTML_OUT = join(V4_ROOT, 'public', 'tool-registry.html');

// ---------------------------------------------------------------------------
// Types (mirrored verbatim into the generated data module).
// ---------------------------------------------------------------------------
type ToolStatus = 'Available' | 'Roadmap';

interface RegistryTool {
  name: string;
  description: string;
  group: string;
  firstShipped: string; // ISO date or 'Unreleased'
  version: string; // v1.<revisions since first ship>
  reviews: string; // honest placeholder
  status: ToolStatus;
}

interface RegistryGroup {
  group: string;
  tools: RegistryTool[];
}

// ---------------------------------------------------------------------------
// Group taxonomy (order = render order). Roadmap tools (no git history) are
// collected into "Coming next" regardless of category.
// ---------------------------------------------------------------------------
const GROUP_ORDER = [
  'Diagnose',
  'Avatar 2.0',
  'Outputs',
  'Funnel',
  'Ledger',
  'Sessions & Feedback',
  'Coming next',
] as const;

const CATEGORY_OF: Record<string, string> = {
  // Diagnose
  health: 'Diagnose',
  run_trust_gap: 'Diagnose',
  run_diagnostic_evidence: 'Diagnose',
  identify_decision_trigger: 'Diagnose',
  compute_trust_gap_lift: 'Diagnose',
  ingest_evidence: 'Diagnose',
  bulk_ingest_evidence: 'Diagnose',
  get_ingest_job: 'Diagnose',
  run_marketing_audit: 'Diagnose',
  generate_audit_idea_map: 'Diagnose',
  audit_asset: 'Diagnose',
  provide_context: 'Diagnose',
  get_context_status: 'Diagnose',
  // Avatar 2.0
  create_avatar: 'Avatar 2.0',
  build_avatar_stage: 'Avatar 2.0',
  get_avatar: 'Avatar 2.0',
  list_avatars: 'Avatar 2.0',
  set_current_avatar: 'Avatar 2.0',
  set_primary_avatar: 'Avatar 2.0',
  set_context_avatars: 'Avatar 2.0',
  record_avatar_build: 'Avatar 2.0',
  // Outputs
  generate_canvas: 'Outputs',
  generate_brief: 'Outputs',
  generate_concepts: 'Outputs',
  generate_positioning_statement: 'Outputs',
  persist_positioning_statement: 'Outputs',
  draft_asset: 'Outputs',
  export_workbook: 'Outputs',
  design_test: 'Outputs',
  publish_filter_check: 'Outputs',
  // Funnel
  run_funnel_audit: 'Funnel',
  get_funnel_audit: 'Funnel',
  get_funnel_assets: 'Funnel',
  get_funnel_coverage: 'Funnel',
  list_funnel_inventory: 'Funnel',
  upsert_funnel_touchpoint: 'Funnel',
  // Ledger
  log_asset: 'Ledger',
  get_asset: 'Ledger',
  get_asset_history: 'Ledger',
  list_assets: 'Ledger',
  update_asset_status: 'Ledger',
  record_assessment: 'Ledger',
  // Sessions & Feedback
  list_coach_conversations: 'Sessions & Feedback',
  get_coach_conversation: 'Sessions & Feedback',
  submit_feedback: 'Sessions & Feedback',
  onboard_choose: 'Sessions & Feedback',
  onboard_panel: 'Sessions & Feedback',
};

// ---------------------------------------------------------------------------
// Parse a tool file for every registerTool / registerAppTool call.
// ---------------------------------------------------------------------------
interface ParsedTool {
  name: string;
  description: string;
  file: string;
}

function parseToolFile(file: string, text: string): ParsedTool[] {
  const out: ParsedTool[] = [];
  // Matches:  server.registerTool('name', { ... description: '...' ... } )
  //           registerAppTool(server, 'name', { ... description: '...' ... } )
  const callRe =
    /register(?:App)?Tool\(\s*(?:server\s*,\s*)?["']([a-z_]+)["']\s*,\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(text)) !== null) {
    const name = m[1];
    // Search forward from the opening brace for the first description: '...'
    const slice = text.slice(m.index, m.index + 1600);
    const descMatch =
      slice.match(/description:\s*\n?\s*["'`]([\s\S]*?)["'`]\s*,/) ?? null;
    let description = descMatch ? descMatch[1] : '';
    description = description
      .replace(/\s+/g, ' ')
      .replace(/\\n/g, ' ')
      .trim();
    out.push({ name, description, file });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Git history for a single file (run inside the MCP worktree).
// ---------------------------------------------------------------------------
function gitHistory(relPath: string): { firstShipped: string; revisions: number } {
  try {
    const log = execFileSync(
      'git',
      ['log', '--follow', '--format=%ad', '--date=short', '--', relPath],
      { cwd: MCP_WORKTREE, encoding: 'utf8' },
    ).trim();
    if (!log) return { firstShipped: 'Unreleased', revisions: 0 };
    const dates = log.split('\n').filter(Boolean);
    return { firstShipped: dates[dates.length - 1], revisions: dates.length };
  } catch {
    return { firstShipped: 'Unreleased', revisions: 0 };
  }
}

// ---------------------------------------------------------------------------
// Build the registry.
// ---------------------------------------------------------------------------
function buildTools(): RegistryTool[] {
  const files = readdirSync(TOOLS_DIR).filter((f) => f.endsWith('.ts'));
  const tools: RegistryTool[] = [];

  for (const file of files) {
    const abs = join(TOOLS_DIR, file);
    const text = readFileSync(abs, 'utf8');
    const parsed = parseToolFile(file, text);
    if (parsed.length === 0) continue;

    const relForGit = join('src', 'mcp', 'tools', file);
    const { firstShipped, revisions } = gitHistory(relForGit);
    const status: ToolStatus = revisions > 0 ? 'Available' : 'Roadmap';
    // Version: v1.(revisions since first ship). First ship == revision 1 => v1.0.
    const version = status === 'Available' ? `v1.${Math.max(0, revisions - 1)}` : 'v1.0';

    for (const p of parsed) {
      const category = CATEGORY_OF[p.name] ?? 'Outputs';
      const group = status === 'Roadmap' ? 'Coming next' : category;
      tools.push({
        name: p.name,
        description: p.description || '—',
        group,
        firstShipped,
        version,
        reviews: 'No reviews yet',
        status,
      });
    }
  }

  return tools.sort((a, b) => a.name.localeCompare(b.name));
}

function groupTools(tools: RegistryTool[]): RegistryGroup[] {
  const byGroup = new Map<string, RegistryTool[]>();
  for (const t of tools) {
    const arr = byGroup.get(t.group) ?? [];
    arr.push(t);
    byGroup.set(t.group, arr);
  }
  return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
    group: g,
    tools: (byGroup.get(g) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

// ---------------------------------------------------------------------------
// Emit: typed TS data module.
// ---------------------------------------------------------------------------
function emitDataModule(groups: RegistryGroup[], total: number, available: number): void {
  mkdirSync(dirname(DATA_OUT), { recursive: true });
  const body = `/**
 * AUTO-GENERATED by scripts/build-tool-registry.ts — DO NOT EDIT BY HAND.
 * Regenerate with: npm run build:tool-registry
 * Generated: ${new Date().toISOString()}
 */

export type ToolStatus = 'Available' | 'Roadmap';

export interface RegistryTool {
  name: string;
  description: string;
  group: string;
  firstShipped: string;
  version: string;
  reviews: string;
  status: ToolStatus;
}

export interface RegistryGroup {
  group: string;
  tools: RegistryTool[];
}

export const TOOL_REGISTRY_TOTAL = ${total};
export const TOOL_REGISTRY_AVAILABLE = ${available};
export const TOOL_REGISTRY_GENERATED_AT = ${JSON.stringify(new Date().toISOString())};

export const TOOL_REGISTRY: readonly RegistryGroup[] = ${JSON.stringify(groups, null, 2)} as const;
`;
  writeFileSync(DATA_OUT, body, 'utf8');
}

// ---------------------------------------------------------------------------
// Emit: standalone static HTML (black bg / gold accents, grouped tables).
// ---------------------------------------------------------------------------
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emitHtml(groups: RegistryGroup[], total: number, available: number): void {
  const generatedAt = new Date().toISOString().slice(0, 10);
  const sections = groups
    .map((g) => {
      const rows = g.tools
        .map((t) => {
          const badge =
            t.status === 'Available'
              ? '<span class="badge avail">Available</span>'
              : '<span class="badge road">Roadmap</span>';
          return `        <tr>
          <td class="tool"><code>${esc(t.name)}</code></td>
          <td class="desc">${esc(t.description)}</td>
          <td class="nowrap">${esc(t.firstShipped)}</td>
          <td class="nowrap">${esc(t.version)}</td>
          <td class="muted">${esc(t.reviews)}</td>
          <td>${badge}</td>
        </tr>`;
        })
        .join('\n');
      return `    <section class="group">
      <h2>${esc(g.group)} <span class="count">${g.tools.length}</span></h2>
      <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Tool</th><th>What it does</th><th>First shipped</th><th>Version</th><th>Reviews</th><th>Status</th></tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
      </div>
    </section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IDEA Brand Coach — Tool Registry</title>
  <meta name="description" content="Every tool the IDEA Brand Coach exposes — what it does, when it first shipped, and its status." />
  <style>
    :root {
      --blk: #111111; --wht: #FFFFFF; --gld: #D4960A; --gld-lt: #FEF5DC;
      --line: #2a2a2a; --muted: #9a9a9a; --row: #161616;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; background: var(--blk); color: var(--wht);
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      line-height: 1.5; -webkit-font-smoothing: antialiased;
    }
    .wrap { max-width: 1080px; margin: 0 auto; padding: 48px 20px 80px; }
    header.page { border-bottom: 1px solid var(--line); padding-bottom: 24px; margin-bottom: 8px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: -0.01em; }
    h1 .accent { color: var(--gld); }
    .sub { color: var(--muted); margin: 0; max-width: 60ch; }
    .stats { display: flex; gap: 24px; margin-top: 20px; flex-wrap: wrap; }
    .stat { background: var(--row); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; }
    .stat .n { font-size: 22px; font-weight: 700; color: var(--gld); }
    .stat .l { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
    .group { margin-top: 40px; }
    .group h2 { font-size: 18px; margin: 0 0 12px; display: flex; align-items: center; gap: 10px; }
    .group h2 .count {
      font-size: 12px; font-weight: 600; color: var(--blk); background: var(--gld);
      border-radius: 999px; padding: 2px 9px;
    }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; min-width: 720px; }
    thead th {
      text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--muted); padding: 12px 14px; border-bottom: 1px solid var(--line); background: var(--row);
    }
    tbody td { padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 14px; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: var(--row); }
    td.tool code { color: var(--gld); font-size: 13px; white-space: nowrap; }
    td.desc { color: #d8d8d8; min-width: 280px; }
    td.muted, .muted { color: var(--muted); }
    .nowrap { white-space: nowrap; color: #cfcfcf; }
    .badge { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
    .badge.avail { background: var(--gld-lt); color: #7a5300; }
    .badge.road { background: #232323; color: var(--muted); border: 1px solid var(--line); }
    footer { margin-top: 48px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--line); padding-top: 20px; }
    @media (max-width: 480px) { h1 { font-size: 23px; } .wrap { padding: 32px 14px 64px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="page">
      <h1>IDEA Brand Coach <span class="accent">Tool Registry</span></h1>
      <p class="sub">Every tool the coach can run for you — what it does, when it first shipped, and whether it's live today. Reviews are shown honestly; nothing is fabricated.</p>
      <div class="stats">
        <div class="stat"><div class="n">${total}</div><div class="l">Tools</div></div>
        <div class="stat"><div class="n">${available}</div><div class="l">Available now</div></div>
        <div class="stat"><div class="n">${total - available}</div><div class="l">Coming next</div></div>
      </div>
    </header>
${sections}
    <footer>Generated ${generatedAt} from the live MCP tool surface + git history. This page is regeneratable — run <code>npm run build:tool-registry</code>.</footer>
  </div>
</body>
</html>
`;
  mkdirSync(dirname(HTML_OUT), { recursive: true });
  writeFileSync(HTML_OUT, html, 'utf8');
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
function main(): void {
  const tools = buildTools();
  const groups = groupTools(tools);
  const total = tools.length;
  const available = tools.filter((t) => t.status === 'Available').length;
  emitDataModule(groups, total, available);
  emitHtml(groups, total, available);
  console.log(
    `tool-registry: ${total} tools (${available} available, ${total - available} roadmap) across ${groups.length} groups`,
  );
  console.log(`  → ${DATA_OUT}`);
  console.log(`  → ${HTML_OUT}`);
}

main();
