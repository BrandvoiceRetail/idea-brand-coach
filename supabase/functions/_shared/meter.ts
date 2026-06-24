/**
 * Credit metering for paid AI operations (Step 2 of docs/PAYWALL_CREDIT_METERING_DESIGN.md).
 *
 * Boundary discipline (mirrors `dataforseo.ts`):
 *  - DENO-FREE pure logic, no top-level `esm.sh` import and no top-level `Deno.env` read, so the
 *    module imports cleanly under vitest. The Supabase service client is INJECTED by the caller
 *    (the edge fn creates it via `getServiceClient()` from `edge-auth.ts`), never created here.
 *  - NEVER throws across the boundary: metering must not break the user's feature. `meterAndDebit`
 *    returns `null` on any failure; `assertCredits` fails OPEN (allow) on a read error.
 *
 * Two entry points an edge fn uses (free ops — the self-report diagnostic — call neither):
 *  - `assertCredits(client, userId, op)` BEFORE the model call — a no-op unless `PAYWALL_ENFORCED`.
 *  - `meterAndDebit(client, {...})` AFTER a SUCCESSFUL model response — always records the real
 *    token usage and debits credits via the `debit_credits` RPC.
 */

/** Minimal Supabase surface this util needs — lets tests pass a lightweight mock. */
export interface CreditClient {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): {
        maybeSingle(): Promise<{ data: { balance: number } | null; error: unknown }>;
      };
    };
  };
}

export type ModelFamily = 'haiku' | 'sonnet' | 'opus';

/** Map a full Anthropic model id (e.g. 'claude-sonnet-4-6') to a rate family. Unknown → sonnet. */
export function modelFamily(modelId: string | null | undefined): ModelFamily {
  const m = (modelId ?? '').toLowerCase();
  if (m.includes('haiku')) return 'haiku';
  if (m.includes('opus')) return 'opus';
  return 'sonnet'; // sonnet is both the common case and the safe default for unknown ids
}

/** Anthropic Messages-API usage block. */
export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
}

/** Result of the `debit_credits` RPC. */
export interface DebitResult {
  credits: number;
  balance: number;
  raw_cost_usd: number;
  locked: boolean;
}

/**
 * Record + debit credits for one paid op. Call AFTER a successful model response.
 * Never throws — on any error it logs and returns null so the feature still completes.
 */
export async function meterAndDebit(
  client: CreditClient,
  args: { userId: string; op: string; model: string; usage: Usage | null | undefined },
): Promise<DebitResult | null> {
  try {
    const inTok = Math.max(0, Math.round(args.usage?.input_tokens ?? 0));
    const outTok = Math.max(0, Math.round(args.usage?.output_tokens ?? 0));
    const { data, error } = await client.rpc('debit_credits', {
      p_user: args.userId,
      p_op: args.op,
      p_model: modelFamily(args.model),
      p_in_tok: inTok,
      p_out_tok: outTok,
    });
    if (error) {
      console.error('[meter] debit_credits failed', { op: args.op, error });
      return null;
    }
    return (data ?? null) as DebitResult | null;
  } catch (e) {
    console.error('[meter] debit_credits threw', { op: args.op, error: String(e) });
    return null;
  }
}

/** Pure gate decision (fully testable): when enforced, block if balance is below the floor. */
export function gateDecision(
  balance: number,
  enforced: boolean,
  floor = 1,
): { ok: boolean; needs_upgrade: boolean } {
  if (!enforced) return { ok: true, needs_upgrade: false };
  const ok = balance >= floor;
  return { ok, needs_upgrade: !ok };
}

/** Read `PAYWALL_ENFORCED` lazily; Deno-safe (returns false under node/vitest). */
function paywallEnforced(): boolean {
  try {
    const g = globalThis as { Deno?: { env: { get(k: string): string | undefined } } };
    return g.Deno?.env.get('PAYWALL_ENFORCED') === 'true';
  } catch {
    return false;
  }
}

/**
 * Pre-op gate. A no-op (always ok) unless `PAYWALL_ENFORCED`. When enforced, blocks if the user's
 * balance is below `floor`. Fails OPEN on a read error so a metering glitch never locks out a
 * paying user — the post-debit still records the truth. `opts.enforced` overrides the env (tests).
 */
export async function assertCredits(
  client: CreditClient,
  userId: string,
  _op: string,
  opts: { floor?: number; enforced?: boolean } = {},
): Promise<{ ok: boolean; needs_upgrade: boolean; balance: number }> {
  const enforced = opts.enforced ?? paywallEnforced();
  const floor = opts.floor ?? 1;
  if (!enforced) return { ok: true, needs_upgrade: false, balance: 0 };
  try {
    const { data } = await client.from('credit_wallets').select('balance').eq('user_id', userId).maybeSingle();
    const balance = data?.balance ?? 0;
    return { ...gateDecision(balance, true, floor), balance };
  } catch (e) {
    console.error('[meter] assertCredits read failed — failing open', { error: String(e) });
    return { ok: true, needs_upgrade: false, balance: 0 };
  }
}
