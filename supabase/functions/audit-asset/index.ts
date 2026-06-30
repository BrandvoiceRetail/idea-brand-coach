import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

/**
 * audit-asset — Brand Funnel Tracker keystone.
 *
 * Scores ONE brand asset (screenshot and/or pasted copy + the user's required context
 * description) against the REAL avatar + current Signature on the four IDEA dimensions,
 * and returns status + a concrete fix.
 *
 * Avatar context is read from `avatar_field_values` (the live store — the avatars jsonb
 * columns are empty). Signature is avatar-scoped first, then the latest brand-level one
 * (avatar_id IS NULL). "Stale" is computed (asset deployed under an older Signature).
 *
 * Hardening: per-user in-memory rate limit; image size guard; private-bucket bytes sent
 * inline as base64 (never a public URL).
 *
 * Request: { assetId, touchpointLabel, brandTask, auditAgainst: string[] }
 */

const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const SONNET_MODEL = "claude-sonnet-4-6";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const RL_MAX = Number(Deno.env.get("FUNNEL_AUDIT_RATE_MAX") ?? 30);
const RL_WINDOW_MS = Number(Deno.env.get("FUNNEL_AUDIT_RATE_WINDOW_MS") ?? 60000);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIMENSIONS = `IDEA dimensions (score each 0-100):
- Insight (i): does the asset show it understands what really drives this customer?
- Distinctive (d): does it stand out and avoid blending in with the category?
- Empathetic (e): would this customer feel understood by it?
- Authentic (a): does it feel genuine and believable, true to the Signature?`;

// Binding leaf -> avatar_field_values field_id(s).
const LEAF_TO_FIELDS: Record<string, string[]> = {
  fears: ["painPoints"],
  desires: ["goals", "emotionalConnection"],
  triggers: ["emotionalTriggers"],
  values: ["brandValues", "psychographics"],
  decision_factors: ["differentiators", "functionalIntent"],
  intent: ["functionalIntent", "identityIntent"],
  shopping_style: ["psychographics"],
  lifestyle: ["demographics"],
  price_consciousness: [],
};
// Always-included core so the audit never runs on empty context.
const CORE_FIELDS = [
  "psychographics", "demographics", "painPoints", "goals", "emotionalTriggers",
  "emotionalConnection", "brandValues", "brandPromise", "positioningStatement",
  "differentiators", "uniqueValue", "consumerInsight", "brandPersonality",
];

const RL = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (RL.get(userId) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_MAX) { RL.set(userId, arr); return true; }
  arr.push(now);
  RL.set(userId, arr);
  return false;
}

function mediaTypeFor(path: string | null): string {
  const p = (path ?? "").toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function buildAvatarContext(fieldMap: Record<string, string>, bindings: string[]): { text: string; used: number } {
  const wanted = new Set<string>(CORE_FIELDS);
  for (const path of bindings) {
    if (path === "signature") continue;
    const leaf = path.includes(".") ? path.split(".")[1] : path;
    for (const f of LEAF_TO_FIELDS[leaf] ?? [leaf]) wanted.add(f);
  }
  const lines: string[] = [];
  for (const f of wanted) {
    const v = fieldMap[f];
    if (v && v.trim()) lines.push(`- ${f}: ${v.trim().slice(0, 300)}`);
  }
  return { text: lines.length ? lines.join("\n") : "(avatar fields not yet filled in)", used: lines.length };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY not configured");
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ ok: false, error: "unauthorized" }, 401);
    if (rateLimited(user.id)) return json({ ok: false, error: "rate_limited" }, 429);

    const { assetId, touchpointLabel, brandTask, auditAgainst, extractOnly } = await req.json();
    if (!assetId) throw new Error("assetId is required");
    const bindings: string[] = Array.isArray(auditAgainst) ? auditAgainst : [];

    const { data: asset, error: assetErr } = await supabase
      .from("brand_assets").select("*").eq("id", assetId).single();
    if (assetErr || !asset) throw new Error("asset not found");

    // Extract-only mode: transcribe the marketing copy VISIBLE in the screenshot so
    // the app can pre-fill "Update stored copy" for the user to review. No scoring,
    // no avatar/signature grounding, no DB write — verbatim transcription only.
    if (extractOnly) {
      if (!asset.storage_path) return json({ ok: true, extracted_copy: "" });
      const { data: blob, error: dlErr } = await supabase.storage.from("brand-assets").download(asset.storage_path);
      if (dlErr || !blob) throw new Error("could not read the screenshot");
      if (blob.size > MAX_IMAGE_BYTES) throw new Error("screenshot too large (max 5MB)");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const img = { type: "image", source: { type: "base64", media_type: mediaTypeFor(asset.storage_path), data: encodeBase64(bytes) } };
      const exResp = await fetch(CLAUDE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicApiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: SONNET_MODEL,
          max_tokens: 1500,
          system: "You transcribe marketing copy from an image. Output the visible copy VERBATIM — headlines, bullets, body, CTAs — preserving line breaks and reading order. Do NOT summarize, rewrite, translate, or invent anything. Output only the transcribed text. If the image has no readable marketing copy, output nothing.",
          messages: [{ role: "user", content: [img, { type: "text", text: "Transcribe the visible marketing copy verbatim." }] }],
        }),
      });
      if (!exResp.ok) throw new Error(`anthropic ${exResp.status}: ${await exResp.text()}`);
      const exOut = await exResp.json();
      const extracted_copy = (exOut.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n")
        .trim();
      return json({ ok: true, extracted_copy });
    }

    // Signature: avatar-scoped first, else latest brand-level (avatar_id IS NULL). RLS scopes to user.
    let sig = null as { artifact_id: string | null; id: string; signature_text: string | null } | null;
    {
      const scoped = await supabase.from("signatures")
        .select("id, signature_text, artifact_id")
        .eq("avatar_id", asset.avatar_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      sig = scoped.data;
      if (!sig) {
        const brandLevel = await supabase.from("signatures")
          .select("id, signature_text, artifact_id")
          .is("avatar_id", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
        sig = brandLevel.data;
      }
    }
    const currentSignatureVersion = sig?.artifact_id ?? sig?.id ?? null;
    const signatureText = sig?.signature_text ?? "(no Signature set yet)";

    // Avatar context from avatar_field_values.
    const { data: fvRows } = await supabase
      .from("avatar_field_values").select("field_id, field_value").eq("avatar_id", asset.avatar_id);
    const fieldMap: Record<string, string> = {};
    for (const r of fvRows ?? []) if (r.field_value) fieldMap[r.field_id as string] = r.field_value as string;
    // Fallback: merge user_knowledge_base (Avatar 2.0 store) so avatars without
    // avatar_field_values still ground the audit. RLS scopes to the caller.
    const { data: ukbRows } = await supabase
      .from("user_knowledge_base").select("field_identifier, content").eq("is_current", true).limit(40);
    for (const r of ukbRows ?? []) {
      const key = String(r.field_identifier).replace(/^avatar_/, "");
      if (r.content && !fieldMap[key]) fieldMap[key] = String(r.content);
    }
    const { text: avatarContext, used: groundingFields } = buildAvatarContext(fieldMap, bindings);

    // Asset content: screenshot (base64) and/or pasted copy.
    let imageBlock: Record<string, unknown> | null = null;
    if (asset.storage_path) {
      const { data: blob, error: dlErr } = await supabase.storage.from("brand-assets").download(asset.storage_path);
      if (!dlErr && blob) {
        if (blob.size > MAX_IMAGE_BYTES) throw new Error("screenshot too large (max 5MB)");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        imageBlock = { type: "image", source: { type: "base64", media_type: mediaTypeFor(asset.storage_path), data: encodeBase64(bytes) } };
      }
    }

    const system = `You are Trevor, a brand coach, auditing whether ONE brand asset is on-strategy.
${DIMENSIONS}

You are given: the asset (a screenshot and/or its copy), the user's short description of what it is, the customer avatar + brand-strategy fields that matter for this touchpoint, and the brand's current Signature. Judge the asset ONLY against these. Do not invent avatar facts. If the asset contradicts or ignores the Signature/avatar, score the relevant dimensions low and say why.

Return your verdict by calling report_audit. The "fix" must be one concrete, on-strategy change to make next (not generic advice).`;

    const userText = `TOUCHPOINT: ${touchpointLabel ?? asset.touchpoint_id} (stage: ${asset.stage})
BRAND TASK AT THIS STAGE: ${brandTask ?? "(n/a)"}

USER'S DESCRIPTION OF THIS ASSET:
${asset.context_description}
${asset.content_text ? `\nASSET COPY (pasted):\n${String(asset.content_text).slice(0, 4000)}` : ""}

AVATAR + BRAND STRATEGY:
${avatarContext}

CURRENT SIGNATURE:
${signatureText}`;

    const content: unknown[] = [];
    if (imageBlock) content.push(imageBlock);
    content.push({ type: "text", text: userText });

    const body = {
      model: SONNET_MODEL,
      max_tokens: 900,
      system,
      tools: [{
        name: "report_audit",
        description: "Report the IDEA-dimension scores, rationale, and one concrete fix for this asset.",
        input_schema: {
          type: "object",
          properties: {
            scores: {
              type: "object",
              properties: {
                i: { type: "integer", minimum: 0, maximum: 100 },
                d: { type: "integer", minimum: 0, maximum: 100 },
                e: { type: "integer", minimum: 0, maximum: 100 },
                a: { type: "integer", minimum: 0, maximum: 100 },
              },
              required: ["i", "d", "e", "a"],
            },
            rationale: { type: "string" },
            fix: { type: "string" },
          },
          required: ["scores", "rationale", "fix"],
        },
      }],
      tool_choice: { type: "tool", name: "report_audit" },
      messages: [{ role: "user", content }],
    };

    const resp = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicApiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`anthropic ${resp.status}: ${await resp.text()}`);
    const out = await resp.json();
    const toolUse = (out.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    if (!toolUse) throw new Error("model did not return an audit");

    const auditResult = toolUse.input as { scores: Record<string, number>; rationale: string; fix: string };
    const s = auditResult.scores;
    const overall = Math.round((s.i + s.d + s.e + s.a) / 4);
    const isStale = !!asset.signature_version && asset.signature_version !== currentSignatureVersion;
    const status = isStale ? "stale" : overall >= 70 ? "aligned" : "misaligned";

    const resultWithGrounding = { ...auditResult, grounding: { fields_used: groundingFields } };
    await supabase.from("brand_assets").update({
      status,
      overall_score: overall,
      previous_score: asset.overall_score ?? null,   // before/after on re-audit
      audit_result: resultWithGrounding,
      signature_version: asset.signature_version ?? currentSignatureVersion,
      updated_at: new Date().toISOString(),
    }).eq("id", assetId);

    return json({ ok: true, status, overall_score: overall, previous_score: asset.overall_score ?? null, audit_result: resultWithGrounding, grounding: { fields_used: groundingFields } });
  } catch (err) {
    console.error("audit-asset error:", err instanceof Error ? err.message : err);
    return json({ ok: false, error: err instanceof Error ? err.message : "audit failed" }, 500);
  }
});
