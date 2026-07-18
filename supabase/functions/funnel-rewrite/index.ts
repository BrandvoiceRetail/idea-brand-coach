import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  buildSystemPrompt,
  buildUserMessage,
  parseRewrite,
  type RewriteInput,
} from "./lib.ts";

/**
 * funnel-rewrite — the "coach rewrites it for you" step of Fix-with-coach.
 * Given an audited asset, produces revised ON-BRAND copy (per avatar + Positioning Statement, applying
 * the audit's fix) plus a lightweight publish-filter: flags risky/unverifiable claims.
 * Request: { assetId }  →  { ok, revised, flags: string[] }
 *
 * COMPETITOR-AGENTS P4 (ST-4) — second request shape, no asset round-trip:
 * { touchpoint_id?, current_copy?, competitor_brief?, avatar_context?, positioning_statement_context? }
 *   →  { rewrite, angle_note }
 * When `assetId` is absent the request is treated as a stateless countermeasure
 * rewrite: the competitor insight's gap_to_our_avatar + strategic_angle drive the
 * brief (pure prompt/parse logic in ./lib.ts), so DraftCountermeasureDialog calls
 * this same canonical fn rather than a forked one.
 */
const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const SONNET_MODEL = "claude-sonnet-4-6";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const CORE_FIELDS = [
  "psychographics", "demographics", "painPoints", "goals", "emotionalTriggers",
  "emotionalConnection", "brandValues", "brandPromise", "positioningStatement",
  "differentiators", "uniqueValue", "brandPersonality",
];
const RL = new Map();
function rateLimited(uid) {
  const now = Date.now();
  const arr = (RL.get(uid) ?? []).filter((t) => now - t < 60000);
  if (arr.length >= 20) { RL.set(uid, arr); return true; }
  arr.push(now); RL.set(uid, arr); return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY not configured");
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) return json({ ok: false, error: "unauthorized" }, 401);
    if (rateLimited(user.id)) return json({ ok: false, error: "rate_limited" }, 429);

    const reqBody = await req.json();

    // ── Competitor-Agents P4 countermeasure path (no asset round-trip) ───────
    // When there is no assetId, treat this as a stateless rewrite driven by the
    // competitor brief + host-supplied context. Returns { rewrite, angle_note }.
    if (!reqBody?.assetId) {
      const input = reqBody as RewriteInput;
      const hasBrief = Boolean(
        input.competitor_brief &&
          (input.competitor_brief.strategic_angle || input.competitor_brief.gap_to_our_avatar),
      );
      if (!hasBrief && !(input.current_copy && input.current_copy.trim())) {
        return json(
          { error: "Provide a competitor_brief (strategic_angle / gap_to_our_avatar) or current_copy to rewrite." },
          400,
        );
      }
      const cmBody = {
        model: SONNET_MODEL, max_tokens: 1500,
        system: buildSystemPrompt(),
        // No assistant prefill — Sonnet 4.6 rejects last-turn prefills (400).
        messages: [{ role: "user", content: buildUserMessage(input) }],
        temperature: 0.6,
      };
      const cmResp = await fetch(CLAUDE_API_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": anthropicApiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify(cmBody) });
      if (!cmResp.ok) throw new Error(`anthropic ${cmResp.status}: ${await cmResp.text()}`);
      const cmOut = await cmResp.json();
      const rawText = (cmOut.content ?? []).find((b) => b.type === "text")?.text ?? "";
      const parsed = parseRewrite(rawText);
      if (!parsed) throw new Error("could not parse the rewrite from model output");
      return json({ rewrite: parsed.rewrite, angle_note: parsed.angle_note });
    }

    const { assetId } = reqBody;
    const { data: asset, error: aErr } = await supabase.from("brand_assets").select("*").eq("id", assetId).single();
    if (aErr || !asset) throw new Error("asset not found");

    let sig = (await supabase.from("positioning_statements").select("positioning_statement_text").eq("avatar_id", asset.avatar_id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
    if (!sig) sig = (await supabase.from("positioning_statements").select("positioning_statement_text").is("avatar_id", null).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
    const positioningStatementText = sig?.positioning_statement_text ?? "(no Positioning Statement set)";

    const { data: fv } = await supabase.from("avatar_field_values").select("field_id, field_value").eq("avatar_id", asset.avatar_id);
    const map = {};
    for (const r of fv ?? []) if (r.field_value) map[r.field_id] = r.field_value;
    const avatarCtx = CORE_FIELDS.map((f) => (map[f] ? `- ${f}: ${String(map[f]).slice(0, 300)}` : "")).filter(Boolean).join("\n") || "(avatar not filled in)";

    const fix = asset.audit_result?.fix ?? "Make it on-brand.";
    const system = `You are Trevor, a brand coach. Rewrite ONE brand asset's copy so it is on-strategy — true to the Positioning Statement and the avatar — applying the recommended fix. Keep it the same kind of asset and length. Then run a publish filter: list any claims that are risky, unverifiable, or could mislead (guarantees, superlatives, health/earnings claims). Return via the rewrite tool.`;
    const userText = `TOUCHPOINT: ${asset.touchpoint_id} (stage ${asset.stage})
WHAT IT IS: ${asset.context_description}
CURRENT COPY: ${asset.content_text ? String(asset.content_text).slice(0, 3000) : "(screenshot only — infer from the description)"}
RECOMMENDED FIX: ${fix}

AVATAR + BRAND STRATEGY:
${avatarCtx}

CURRENT POSITIONING STATEMENT:
${positioningStatementText}`;

    const body = {
      model: SONNET_MODEL, max_tokens: 1200, system,
      tools: [{ name: "rewrite", description: "Return the revised on-brand copy and any publish-filter flags.", input_schema: { type: "object", properties: { revised: { type: "string" }, flags: { type: "array", items: { type: "string" } } }, required: ["revised", "flags"] } }],
      tool_choice: { type: "tool", name: "rewrite" },
      messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
    };
    const resp = await fetch(CLAUDE_API_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": anthropicApiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(`anthropic ${resp.status}: ${await resp.text()}`);
    const out = await resp.json();
    const tool = (out.content ?? []).find((b) => b.type === "tool_use");
    if (!tool) throw new Error("model did not return a rewrite");
    return json({ ok: true, revised: tool.input.revised, flags: tool.input.flags ?? [] });
  } catch (err) {
    console.error("funnel-rewrite error:", err instanceof Error ? err.message : err);
    return json({ ok: false, error: err instanceof Error ? err.message : "rewrite failed" }, 500);
  }
});
