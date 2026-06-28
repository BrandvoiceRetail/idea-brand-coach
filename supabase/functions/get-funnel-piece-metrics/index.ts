import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * get-funnel-piece-metrics — aggregated campaign_metrics for ONE funnel piece.
 *
 * The v4 Fix piece-detail screen (src/services/v4/fixService.ts → getPieceMetrics)
 * calls this to render a piece's numbers. It reads `campaign_metrics` scoped to the
 * caller (RLS: user_id = auth.uid()) for one `brand_asset_id` over a date window and
 * returns one aggregated row per metric_name.
 *
 * NO FABRICATION: returns ONLY metric rows that actually exist for the caller's own
 * piece. An empty result is honest no-data (the UI shows "—"). The frontend derives
 * cvr/aov from primitives, so this never invents a rate.
 *
 * Aggregation over the window:
 *   - additive metrics (counts, revenue, spend) → SUM
 *   - rate / per-unit metrics (ctr, cvr, aov, opens, *_rate, roas, acos, cpc) → AVG
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

// Metrics that SUM across the window. Everything else (rates, per-unit currency,
// ratios) AVERAGES. Mirrors the v4Funnel METRIC_META formats (count + additive
// currency are summable; percent/ratio/AOV/CPC are not).
const ADDITIVE = new Set<string>([
  "impressions", "sessions", "clicks", "views", "engagement",
  "orders", "revenue", "spend", "units_sold", "calls_booked", "subscribe_save",
]);

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

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
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

  // Aggregate per metric_name: SUM for additive, AVG otherwise. Source: prefer
  // "windsor" if any row is windsor, else the most-recent row's source.
  const acc = new Map<string, { sum: number; count: number; source: string | null; latest: string }>();
  for (const r of rows) {
    const value = typeof r.metric_value === "number" ? r.metric_value : Number(r.metric_value);
    if (!Number.isFinite(value)) continue;
    const cur = acc.get(r.metric_name) ?? { sum: 0, count: 0, source: null, latest: "" };
    cur.sum += value;
    cur.count += 1;
    if (r.source === "windsor") {
      cur.source = "windsor";
    } else if (cur.source !== "windsor" && r.measured_date >= cur.latest) {
      cur.source = r.source ?? cur.source;
      cur.latest = r.measured_date;
    }
    acc.set(r.metric_name, cur);
  }

  const metrics = [...acc.entries()].map(([metric_name, a]) => ({
    metric_name,
    metric_value: ADDITIVE.has(metric_name) ? a.sum : a.sum / a.count,
    source: a.source,
  }));

  return json({ metrics });
});
