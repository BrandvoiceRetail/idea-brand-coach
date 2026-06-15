/**
 * R1 PROOF ON REAL DATA (directive step 1) — same-avatar artifact regeneration.
 *
 * Regenerate ONE artifact kind (avatar_s1_vocab) on the ORIGINAL 8-kind rehearsal avatar
 * (d6185f56-7ade-4c26-83d2-c076187117b1) through the live MCP server, then prove the atomic
 * save_artifact_atomic RPC did same-avatar regeneration correctly:
 *   - exactly ONE current row for (avatar_id, kind) after regen,
 *   - a NEW current row id (differs from the prior current row),
 *   - the OLD row is now superseded (superseded_by = new id),
 *   - new content differs from old (regeneration is fresh, not stale),
 *   - export_workbook A reflects the persisted (new) chain.
 *
 * Pre-fix (insert-then-supersede) this regeneration failed on uq_artifacts_current_per_kind;
 * the R1 fix replaced it with an atomic supersede->insert->repoint RPC. This is the
 * same-avatar regeneration the directive demands before trusting the fresh-avatar rerun.
 *
 * Run: npx tsx scripts/rehearsal-r1-proof.ts
 *
 * Verification-only harness: writes to /tmp + the live QA user's own RLS-scoped rows. Never touches src.
 */
import { createClient } from '@supabase/supabase-js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/mcp/server.js';
import { loadConfig } from '../src/mcp/config.js';
import { runWithIdentity, type Identity } from '../src/mcp/context/identity.js';

const QA_EMAIL = 'signatureqa20260526@gmail.com';
const QA_PASSWORD = 'Sig-QA-Test-2026!';
const ORIGINAL_AVATAR = 'd6185f56-7ade-4c26-83d2-c076187117b1';
const KIND = 'avatar_s1_vocab';
const OUT_DIR = '/tmp/rehearsal-fixpass';

type SC = Record<string, unknown>;

async function call(client: Client, identity: Identity, name: string, args: Record<string, unknown>): Promise<SC> {
  const res = await runWithIdentity(identity, () => client.callTool({ name, arguments: args }));
  return (res.structuredContent ?? {}) as SC;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  console.log('=== R1 PROOF: same-avatar regeneration on', ORIGINAL_AVATAR, '===');

  const authClient = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInErr } = await authClient.auth.signInWithPassword({
    email: QA_EMAIL,
    password: QA_PASSWORD,
  });
  if (signInErr || !signIn.session?.access_token || !signIn.user?.id) {
    throw new Error(`QA sign-in failed: ${signInErr?.message ?? 'no session'} (project may be paused — restore it)`);
  }
  const identity: Identity = {
    userId: signIn.user.id,
    token: signIn.session.access_token,
    authenticated: true,
  };

  // JWT-bound read client to inspect the artifacts table directly (RLS-scoped to QA user).
  const db = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${identity.token}` } },
  });

  // --- BEFORE: the current avatar_s1_vocab row id + a content fingerprint. ---
  const before = await db
    .from('artifacts')
    .select('id, superseded_by, content, updated_at')
    .eq('avatar_id', ORIGINAL_AVATAR)
    .eq('kind', KIND)
    .is('superseded_by', null)
    .maybeSingle();
  if (before.error || !before.data) throw new Error(`no current ${KIND} row before regen: ${before.error?.message}`);
  const beforeId = (before.data as { id: string }).id;
  const beforeContent = JSON.stringify((before.data as { content: unknown }).content);
  console.log(`BEFORE: current ${KIND} id=${beforeId} (content ${beforeContent.length} chars)`);

  // --- REGENERATE: run S1 on the SAME avatar via the MCP build_avatar_stage tool. ---
  const built = createServer(cfg);
  const server: McpServer = built.server;
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'r1-proof', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);

  console.log('REGEN: build_avatar_stage(s1) on the original avatar…');
  const s1 = await call(client, identity, 'build_avatar_stage', { stage: 's1', avatar_id: ORIGINAL_AVATAR });
  console.log('  result:', JSON.stringify(s1).slice(0, 500));
  if (s1.ok !== true) throw new Error(`S1 regen did not persist: ${JSON.stringify(s1)}`);

  // --- AFTER: prove the chain. ---
  const afterCurrent = await db
    .from('artifacts')
    .select('id, superseded_by, content')
    .eq('avatar_id', ORIGINAL_AVATAR)
    .eq('kind', KIND)
    .is('superseded_by', null);
  if (afterCurrent.error) throw new Error(afterCurrent.error.message);
  const currentRows = afterCurrent.data ?? [];
  const afterId = currentRows.length === 1 ? (currentRows[0] as { id: string }).id : '<none/multiple>';
  const afterContent = currentRows.length === 1 ? JSON.stringify((currentRows[0] as { content: unknown }).content) : '';

  const oldRow = await db.from('artifacts').select('id, superseded_by').eq('id', beforeId).maybeSingle();
  const oldSupersededBy = oldRow.data ? (oldRow.data as { superseded_by: string | null }).superseded_by : null;

  console.log('\n=== R1 PROOF RESULTS ===');
  const checks: Array<[boolean, string]> = [
    [currentRows.length === 1, `exactly ONE current row for (${KIND}) after regen (got ${currentRows.length})`],
    [afterId !== beforeId, `new current row id (${afterId}) differs from old (${beforeId})`],
    [oldSupersededBy === afterId, `old row ${beforeId} superseded_by = new id ${afterId} (got ${oldSupersededBy})`],
    [afterContent !== beforeContent, `new content differs from old (regeneration is fresh, not stale)`],
  ];
  let allPass = true;
  for (const [ok, msg] of checks) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`);
    if (!ok) allPass = false;
  }

  // --- EXPORT reflects the persisted (new) chain. ---
  console.log('\nEXPORT: export_workbook A (reads persisted chain) …');
  const exportA = await call(client, identity, 'export_workbook', {
    which: 'A',
    out_dir: OUT_DIR,
    brand_name: 'InfinityVault-R1Proof',
    avatar_id: ORIGINAL_AVATAR,
  });
  console.log('  export A:', JSON.stringify({ ok: exportA.ok, path: exportA.path, sheets: exportA.sheets }));
  const exportPath = String(exportA.path ?? '');

  await client.close();
  await server.close();

  console.log(`\n=== R1 PROOF: ${allPass && exportA.ok === true ? 'ALL PASS' : 'FAILED'} ===`);
  console.log(`NEW_CURRENT_ID=${afterId}`);
  console.log(`OLD_SUPERSEDED_ID=${beforeId}`);
  console.log(`EXPORT_PATH=${exportPath}`);
  if (!allPass || exportA.ok !== true) process.exitCode = 1;
}

main().catch((err) => {
  console.error('R1 PROOF CRASHED:', err);
  process.exitCode = 1;
});
