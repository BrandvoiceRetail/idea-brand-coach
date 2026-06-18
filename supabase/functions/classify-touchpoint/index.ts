import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * classify-touchpoint — bulk-upload helper. Given a screenshot, pick which funnel
 * touchpoint it most likely is, from the brand's applicable candidates. Lets a user
 * drop a folder of screenshots and skip the manual picker (still editable client-side).
 * Request: { imageBase64, mediaType, candidates: [{ id, label, stage }] }
 * Response: { ok, touchpoint_id }
 */
const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const SONNET_MODEL = "claude-sonnet-4-6";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY not configured");
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) return json({ ok: false, error: "unauthorized" }, 401);

    const { imageBase64, mediaType, candidates } = await req.json();
    if (!imageBase64 || !Array.isArray(candidates) || candidates.length === 0) throw new Error("imageBase64 and candidates are required");

    const list = candidates.map((c) => `- ${c.id} — ${c.label} (${c.stage})`).join("\n");
    const enumIds = candidates.map((c) => c.id);
    const body = {
      model: SONNET_MODEL, max_tokens: 120,
      system: `You classify a brand asset screenshot into ONE funnel touchpoint. Choose the single best match from the candidate list. If unsure, pick the closest. Return via the classify tool.`,
      tools: [{ name: "classify", description: "Return the best-matching touchpoint id.", input_schema: { type: "object", properties: { touchpoint_id: { type: "string", enum: enumIds } }, required: ["touchpoint_id"] } }],
      tool_choice: { type: "tool", name: "classify" },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType || "image/png", data: imageBase64 } },
        { type: "text", text: `Candidate touchpoints:\n${list}\n\nWhich one is this screenshot?` },
      ] }],
    };
    const resp = await fetch(CLAUDE_API_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": anthropicApiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(`anthropic ${resp.status}: ${await resp.text()}`);
    const out = await resp.json();
    const tool = (out.content ?? []).find((b) => b.type === "tool_use");
    const touchpoint_id = tool?.input?.touchpoint_id ?? candidates[0].id;
    return json({ ok: true, touchpoint_id });
  } catch (err) {
    console.error("classify-touchpoint error:", err instanceof Error ? err.message : err);
    return json({ ok: false, error: err instanceof Error ? err.message : "classify failed" }, 500);
  }
});
