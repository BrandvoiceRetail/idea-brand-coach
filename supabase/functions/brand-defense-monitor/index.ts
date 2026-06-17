import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createRateLimiter, rateLimitKey } from "../_shared/rateLimit.ts";
import {
  TitanAlertSource,
  mapCategoryToDimension,
  deriveSeverity,
  buildInterpretation,
  buildResponseBrief,
  pendingDraftedResponse,
  type IAlertSource,
  type AlertEvent,
  type AlertSourceContext,
  type DraftedResponse,
} from "./lib.ts";

/**
 * brand-defense-monitor  (Competitor-Agents P6 — Track B, the defense loop)
 *
 * For an avatar/brand, polls the registered alert sources, and for each grounded
 * alert: maps the event to the threatened IDEA dimension, builds an IDEA-scored
 * interpretation, drafts a defensive response (by chaining the existing
 * generate_concepts → draft_asset → publish_filter_check capabilities), logs the
 * drafted asset to the IV-OS asset ledger, and raises an in-app alert
 * (brand_defense_alerts) backing the funnel unread badge.
 *
 * STUB / HALT (per Trevor): the only wired source is `TitanAlertSource`, a STUB
 * whose coverage is UNVERIFIED. It returns a clearly-marked fixture (only when
 * TITAN_STUB_FIXTURE=true) or an empty list — never a fabricated live threat. A
 * real Titan adapter is a separate, human-gated initiative.
 *
 * Pure logic (the source contract + Titan stub + dimension mapping + response
 * shaping) lives in ./lib.ts (Deno-free, unit-tested under vitest). This file is
 * the thin Deno edge entry wiring HTTP, auth, generation/ledger seams, and
 * persistence. Clones the competitor-analysis-asset edge boilerplate (CORS,
 * optional JWT, abuse controls, JSON error envelope).
 *
 * GROUNDING GATE (plan §3): never fabricate competitors, prices, IDEA scores, or
 * quotes. The IDEA mapping is deterministic; the interpretation is templated from
 * the source's own fields; the drafted response defaults to `pending-generation`
 * (not a fabricated draft) whenever the generation chain cannot be reached.
 *
 * Request:  { avatarId?, asins?:string[], marketplace?, emitTitanFixture? }
 * Response: { alerts:[{ id, category, threatened_dimension, severity, title,
 *             interpretation, drafted_response, ledger_request_id }],
 *             sources:[{ name, coverage_verified }], raised:number }
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-6';
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

// ── Abuse controls (mirror competitor-analysis-asset; env-tunable) ───────────
const MAX_BODY_BYTES = Number(Deno.env.get('BRAND_DEFENSE_MAX_BODY_BYTES') ?? '32768');
const RATE_LIMIT_MAX = Number(Deno.env.get('BRAND_DEFENSE_RATE_LIMIT_MAX') ?? '20');
const RATE_LIMIT_WINDOW_MS = Number(Deno.env.get('BRAND_DEFENSE_RATE_LIMIT_WINDOW_MS') ?? '60000');

// Only emit the Titan stub fixture when explicitly enabled (wiring tests).
const TITAN_STUB_FIXTURE = (Deno.env.get('TITAN_STUB_FIXTURE') ?? 'false') === 'true';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Per-isolate sliding-window limiter, keyed per user (JWT sub) or per IP.
const rateLimiter = createRateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

interface MonitorRequest {
  avatarId?: string;
  asins?: string[];
  marketplace?: string;
  /** Test-only: emit the clearly-marked Titan stub fixture (overrides env). */
  emitTitanFixture?: boolean;
}

/**
 * Run one alert source, swallowing any throw so a single bad source never breaks
 * the run (the source contract says fetchAlerts must not throw, but we defend).
 */
async function runSource(source: IAlertSource, ctx: AlertSourceContext): Promise<AlertEvent[]> {
  try {
    return await source.fetchAlerts(ctx);
  } catch (err) {
    console.error(`[brand-defense-monitor] source '${source.name}' threw (treated as no alerts):`, err);
    return [];
  }
}

/**
 * Draft a defensive response by chaining the existing capabilities
 * (generate_concepts → draft_asset → publish_filter_check).
 *
 * Those capabilities live as MCP tools (src/mcp/tools/*) and Supabase edge fns
 * (brand-copy-generator / publish-filter); they are NOT directly callable as a
 * single chain from inside THIS edge function without the MCP host. So we shape
 * the brief the chain consumes and attempt a single grounded draft via the
 * Anthropic API (the brand-copy-generator pattern). When no API key is present,
 * we return a `pending-generation` envelope (never a fabricated draft).
 *
 * TODO(competitor-agents:defense-capability-chain): route this through the MCP
 * capability layer so the SAME generate_concepts/draft_asset/publish_filter_check
 * tools the coach uses produce the response (unified-capability-layer ADR).
 */
async function draftResponse(event: AlertEvent): Promise<DraftedResponse> {
  const dimension = mapCategoryToDimension(event.category);
  const brief = buildResponseBrief(event, dimension);

  if (!anthropicApiKey) {
    return pendingDraftedResponse(event, dimension);
  }

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 800,
        system: [{
          type: 'text',
          text:
            'You draft short, on-brand defensive copy responding to a brand-protection threat. ' +
            'Ground strictly in the supplied brief. Never invent competitor names, prices, or quotes. ' +
            'No markdown, no emojis, UK English. Return ONLY the copy, no preamble.',
          cache_control: { type: 'ephemeral' },
        }],
        // No assistant prefill — Sonnet 4.6 rejects last-turn prefills (400).
        messages: [{ role: 'user', content: brief }],
        temperature: 0.5,
      }),
    });
    if (!response.ok) {
      console.error('[brand-defense-monitor] Anthropic API error:', response.status);
      return pendingDraftedResponse(event, dimension);
    }
    const data = await response.json();
    const copy: string = (data?.content?.[0]?.text ?? '').trim();
    if (!copy) return pendingDraftedResponse(event, dimension);

    // Publish-filter: the publish_filter_check capability is not callable inline
    // here; record the verdict as pending so it is never fabricated as "passed".
    // TODO(competitor-agents:defense-capability-chain): call publish_filter_check.
    return {
      status: 'drafted',
      brief,
      copy,
      publish_filter: { passed: false, notes: 'pending — publish_filter_check not run inline' },
      threatened_dimension: dimension,
    };
  } catch (err) {
    console.error('[brand-defense-monitor] draftResponse threw (non-fatal):', err);
    return pendingDraftedResponse(event, dimension);
  }
}

/**
 * Log the drafted asset to the IV-OS asset ledger (log_asset) and drive its
 * status (update_asset_status). Those are IV-OS MCP writes reached via the
 * server-side MCP client (src/mcp/ivos/client.ts) — NOT callable from this edge
 * function. We shape the ledger payload and return a null request_id, leaving a
 * TODO for the host to perform the actual ledger write.
 *
 * TODO(competitor-agents:defense-ledger-write): route the drafted response
 * through the MCP log_asset / update_asset_status writes (identity-gated) so the
 * defensive asset lands in the IV-OS ledger and shows up in get_asset_history.
 */
function shapeLedgerWrite(event: AlertEvent, drafted: DraftedResponse): Record<string, unknown> {
  return {
    content: drafted.copy ?? drafted.brief,
    content_type: 'competitor',
    agent_name: 'brand-defense-monitor',
    status: drafted.status === 'drafted' ? 'success' : 'pending',
    // The approval transition the host should drive after logging:
    next_status: 'in_review',
    source_alert: event.external_id,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Per-user when authenticated (key by JWT sub), else per-IP.
  if (rateLimiter.isRateLimited(rateLimitKey(req))) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please slow down and try again shortly.' }),
      {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
      },
    );
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Request body too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let body: MonitorRequest;
    try {
      body = rawBody ? (JSON.parse(rawBody) as MonitorRequest) : {};
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Optional auth: resolve user + a request-scoped client for persistence.
    const authHeader = req.headers.get('authorization');
    let supabaseClient: ReturnType<typeof createClient> | null = null;
    if (authHeader) {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
      );
    }

    // Registered alert sources. Only the Titan STUB is wired (coverage UNVERIFIED).
    // TODO(competitor-agents:alert-sources): register real sources (Brand Registry
    // listing-change feeds, Buy-Box monitors, compliance + review monitors).
    const emitFixture = body.emitTitanFixture ?? TITAN_STUB_FIXTURE;
    const sources: IAlertSource[] = [new TitanAlertSource(emitFixture)];

    const ctx: AlertSourceContext = {
      avatarId: body.avatarId,
      asins: Array.isArray(body.asins) ? body.asins.filter((a) => typeof a === 'string') : undefined,
      marketplace: body.marketplace,
    };

    const events: Array<{ source: IAlertSource; event: AlertEvent }> = [];
    for (const source of sources) {
      const sourceEvents = await runSource(source, ctx);
      for (const event of sourceEvents) events.push({ source, event });
    }

    const raised: Array<Record<string, unknown>> = [];
    for (const { source, event } of events) {
      const dimension = mapCategoryToDimension(event.category);
      const severity = deriveSeverity(event);
      const interpretation = buildInterpretation(event, dimension);
      const drafted = await draftResponse(event);
      // The ledger write is shaped here but performed by the host (see TODO).
      const ledgerPayload = shapeLedgerWrite(event, drafted);
      const ledgerRequestId: string | null = null; // host performs the IV-OS write.

      const alertRow = {
        avatar_id: body.avatarId ?? null,
        category: event.category,
        threatened_dimension: dimension,
        severity,
        title: event.title,
        interpretation,
        source_payload: {
          source: source.name,
          coverage: source.coverageVerified ? 'verified' : 'unverified',
          external_id: event.external_id,
          evidence: event.evidence ?? [],
          ledger_payload: ledgerPayload,
        },
        drafted_response: drafted,
        ledger_request_id: ledgerRequestId,
      };

      // Persist the in-app alert (only when authed + an avatarId is supplied).
      let alertId: string | null = null;
      if (supabaseClient && body.avatarId) {
        try {
          // TODO(types-regen): brand_defense_alerts is not in the generated supabase
          // types yet (migration unapplied to prod) — cast the builder at the boundary.
          const { data: inserted, error: insertError } = await (supabaseClient
            .from('brand_defense_alerts') as unknown as {
              insert: (r: unknown) => {
                select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> };
              };
            })
            .insert(alertRow)
            .select('id')
            .single();
          if (insertError) {
            console.error('[brand-defense-monitor] Alert persist error:', insertError);
          } else if (inserted) {
            alertId = inserted.id;
          }
        } catch (persistErr) {
          console.error('[brand-defense-monitor] Alert persist threw (non-fatal):', persistErr);
        }
      }

      raised.push({
        id: alertId,
        category: event.category,
        threatened_dimension: dimension,
        severity,
        title: event.title,
        interpretation,
        drafted_response: drafted,
        ledger_request_id: ledgerRequestId,
      });
    }

    console.log(`[brand-defense-monitor] Ran ${sources.length} source(s); raised ${raised.length} alert(s) for avatar ${body.avatarId ?? 'none'} (titan coverage: unverified).`);

    return new Response(
      JSON.stringify({
        alerts: raised,
        sources: sources.map((s) => ({ name: s.name, coverage_verified: s.coverageVerified })),
        raised: raised.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in brand-defense-monitor function:', error);
    const detail = error instanceof Error ? error.message.slice(0, 200) : 'unknown';
    return new Response(
      JSON.stringify({ error: 'Unable to run the brand-defense monitor right now. Please try again.', detail }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
