import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * get-funnel-piece-metrics — primitive-derived metrics for ONE funnel piece.
 *
 * Reads `campaign_metrics` RLS-scoped to the caller for one `brand_asset_id` over a
 * 7d/30d/90d window and returns one row per metric. RATES ARE DERIVED FROM SUMMED
 * PRIMITIVES — never averaged from stored rate rows:
 *   ctr = Σclicks / Σimpressions
 *   cvr = Σunits_sold (else Σorders) / Σsessions   (Amazon unit-session %; falls back
 *         to Σorders / Σclicks for ad-only pieces)
 *   aov = Σrevenue / Σorders
 * Primitives (sessions, views, clicks, impressions, orders, units_sold, revenue,
 * spend, …) are summed. This is the correct window aggregation — averaging Amazon's
 * pre-averaged percentages distorts (mean of ratios ≠ ratio of sums) — and it lets
 * onboarding pull ONLY raw primitives from Windsor (fast, fewer fields). A stored rate
 * is used ONLY as a fallback when its primitives are absent. NO FABRICATION: only rows
 * that exist; an empty result is honest no-data (the UI shows "—").
 *
 * Request:  { brand_asset_id: string (uuid), range?: "7d" | "30d" | "90d" }  (default 30d)
 * Response: { metrics: Array<{ metric_name: string; metric_value: number; source: string | null }> }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

// Primitives that SUM across the window.
const ADDITIVE = new Set<string>([
  "impressions", "sessions", "clicks", "views", "engagement",
  "orders", "revenue", "spend", "units_sold", "calls_booked", "subscribe_save",
]);
// Rates we DERIVE from primitives — any stored value is ignored unless primitives are missing.
const DERIVED = new Set<string>(["ctr", "cvr", "aov"]);

interface MetricRow {
  metric_name: string;
  metric_value: number | string | null;
  source: string | null;
  measured_date: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Auth: build a client with the caller's JWT so RLS scopes every read to them.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // getUser() must be passed the token explicitly — the global Authorization header
  // scopes PostgREST/RLS reads but auth.getUser() with no arg reads an (empty) session.
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: "Not authenticated" }, 401);

  let payload: { brand_asset_id?: unknown; range?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const brandAssetId = typeof payload.brand_asset_id === "string" ? payload.brand_asset_id.trim() : "";
  if (!brandAssetId) return json({ error: "brand_asset_id is required" }, 400);

  const range = typeof payload.range === "string" && payload.range in RANGE_DAYS ? payload.range : "30d";
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - RANGE_DAYS[range]);
  const sinceDate = since.toISOString().slice(0, 10);

  // RLS restricts to the caller's own rows; the brand_asset_id filter scopes to the
  // one piece (and the owner-guard trigger guarantees the asset is theirs).
  const { data, error } = await supabase
    .from("campaign_metrics")
    .select("metric_name, metric_value, source, measured_date")
    .eq("brand_asset_id", brandAssetId)
    .gte("measured_date", sinceDate);

  if (error) {
    return json({ error: "Could not read metrics", detail: error.message }, 500);
  }

  const rows = (data ?? []) as MetricRow[];

  // Accumulate per metric_name: Σ value, n (for averaging residual stored rates), source.
  const sum = new Map<string, number>();
  const n = new Map<string, number>();
  const src = new Map<string, { source: string | null; latest: string }>();
  for (const r of rows) {
    const value = typeof r.metric_value === "number" ? r.metric_value : Number(r.metric_value);
    if (!Number.isFinite(value)) continue;
    sum.set(r.metric_name, (sum.get(r.metric_name) ?? 0) + value);
    n.set(r.metric_name, (n.get(r.metric_name) ?? 0) + 1);
    const cur = src.get(r.metric_name) ?? { source: null, latest: "" };
    if (r.source === "windsor") {
      cur.source = "windsor";
    } else if (cur.source !== "windsor" && r.measured_date >= cur.latest) {
      cur.source = r.source ?? cur.source;
      cur.latest = r.measured_date;
    }
    src.set(r.metric_name, cur);
  }

  const tot = (k: string): number | null => (sum.has(k) ? sum.get(k)! : null);
  const avg = (k: string): number | null => (sum.has(k) ? sum.get(k)! / (n.get(k) || 1) : null);
  const srcOf = (...keys: string[]): string | null => {
    for (const k of keys) {
      const s = src.get(k)?.source;
      if (s) return s;
    }
    return null;
  };

  const out: { metric_name: string; metric_value: number; source: string | null }[] = [];

  // 1) Primitives summed; any residual non-derived stored metric → averaged fallback.
  //    DERIVED rates are never passed through — they are computed from primitives below.
  for (const [name] of sum) {
    if (DERIVED.has(name)) continue;
    const value = ADDITIVE.has(name) ? tot(name)! : avg(name)!;
    out.push({ metric_name: name, metric_value: value, source: src.get(name)?.source ?? null });
  }

  // 2) Derive rates from summed primitives; fall back to a stored rate only if the
  //    primitives are absent (so legacy pre-computed rows still render).
  const sessions = tot("sessions");
  const clicks = tot("clicks");
  const impressions = tot("impressions");
  const orders = tot("orders");
  const units = tot("units_sold");
  const revenue = tot("revenue");
  const conv = units ?? orders; // unit-session basis preferred (Amazon unit-session %), else orders

  const ctr =
    impressions !== null && impressions > 0 && clicks !== null ? clicks / impressions : avg("ctr");
  const cvr =
    sessions !== null && sessions > 0 && conv !== null
      ? conv / sessions
      : clicks !== null && clicks > 0 && orders !== null
        ? orders / clicks
        : avg("cvr");
  const aov = orders !== null && orders > 0 && revenue !== null ? revenue / orders : avg("aov");

  const pushRate = (name: string, value: number | null, ...srcKeys: string[]): void => {
    if (value !== null && Number.isFinite(value)) {
      out.push({ metric_name: name, metric_value: value, source: srcOf(...srcKeys, name) });
    }
  };
  pushRate("ctr", ctr, "impressions", "clicks");
  pushRate("cvr", cvr, "sessions", "units_sold", "orders", "clicks");
  pushRate("aov", aov, "orders", "revenue");

  return json({ metrics: out });
});
