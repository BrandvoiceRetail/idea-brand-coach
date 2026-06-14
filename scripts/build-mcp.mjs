/**
 * Bundle the brand-coach MCP gateway into a single self-contained Node file.
 *
 * The gateway is deployed as its own service (deploy/mcp/) — separate from the Vite
 * SPA — so it can later be lifted into a standalone repo. esbuild bundles
 * `src/mcp/index.ts` (host + streamable-HTTP transport + all 24 tools + the inlined
 * onboarding panel client + @supabase/supabase-js + the MCP SDK) into one ESM file
 * the runtime image runs with plain `node` — no tsx, no node_modules to ship.
 *
 * Regenerate: `npm run mcp:bundle` (also run by `npm run mcp:build:docker`).
 */
import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(root, 'src/mcp/index.ts');
const outfile = resolve(root, 'dist-mcp/server.mjs');

await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node20'],
  outfile,
  // Some transitive deps are CommonJS and call require() internally; ESM output
  // has no require, so re-create it from import.meta.url.
  banner: {
    js: "import { createRequire as _createRequire } from 'module'; const require = _createRequire(import.meta.url);",
  },
  legalComments: 'none',
  logLevel: 'info',
});

console.log(`Wrote ${outfile}`);
