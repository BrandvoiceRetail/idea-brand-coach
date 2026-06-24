import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { clientIp, createRateLimiter } from "../_shared/rateLimit.ts";

// submit-diagnostic-lead — lead-magnet capture for the free Trust Gap diagnostic.
//
// PUBLIC by design (verify_jwt = false): anonymous visitors complete the free
// diagnostic before signup and submit email + scores here. The lead is captured
// into public.leads via the SERVICE-ROLE client (RLS enabled, no policies, so
// the table is service-role only). A deterministic Trust Gap report email is
// built from the posted scores and sent via Resend ONLY when RESEND_API_KEY is
// configured; when it is absent the lead is still captured and we return
// emailed:false with a 200 (never lose a lead over a missing email key).
//
// Abuse controls: consent is REQUIRED, email is format-validated, the body is
// size-capped, and a best-effort per-isolate IP rate limit bounds rapid-fire
// abuse. NO PII (email/name/company) is ever logged or sent to PostHog; the
// client IP is used for the rate-limit key only and is never stored.

// ── Tunables (override via function env without a logic redeploy) ────────────
const MAX_BODY_BYTES = Number(Deno.env.get("LEAD_MAX_BODY_BYTES") ?? "8192");
const RATE_LIMIT_MAX = Number(Deno.env.get("LEAD_RATE_LIMIT_MAX") ?? "10"); // requests...
const RATE_LIMIT_WINDOW_MS = Number(Deno.env.get("LEAD_RATE_LIMIT_WINDOW_MS") ?? "60000"); // ...per window (default 60s)
const LEAD_FROM_EMAIL = Deno.env.get("LEAD_FROM_EMAIL") ?? "Trevor <noreply@app.ideabrandconsultancy.com>";
const LEAD_CTA_URL = Deno.env.get("LEAD_CTA_URL") ?? "https://ideabrandcoach.icodemybusiness.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// On-brand palette.
const NAVY = "#1A3557";
const GOLD = "#C9A84C";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" } as const;

// A per-isolate sliding-window limiter keyed by client IP (best-effort; resets
// on cold start). Module-level so one limiter is shared across warm requests.
const limiter = createRateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

// Pragmatic email format check — bounds obviously-bad input without trying to be
// an RFC-complete validator (the address is also confirmed downstream by a real
// send when configured).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Dimension = "insight" | "distinctive" | "empathetic" | "authentic";
const DIMENSIONS: Dimension[] = ["insight", "distinctive", "empathetic", "authentic"];
const DIMENSION_LABELS: Record<Dimension, string> = {
  insight: "Insight",
  distinctive: "Distinctive",
  empathetic: "Empathetic",
  authentic: "Authentic",
};

interface LeadScores {
  insight: number;
  distinctive: number;
  empathetic: number;
  authentic: number;
  overall: number;
}

interface ParsedLead {
  email: string;
  name: string | null;
  company: string | null;
  consent: boolean;
  scores: LeadScores;
  answers: Record<string, unknown> | null;
  primaryGap: Dimension;
  posthogDistinctId: string | null;
  utm: Record<string, unknown> | null;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Trim + bound a free-text string; returns null when empty or not a string. */
function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}

/** Escape user-supplied text before embedding it in the HTML email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Validate and normalize the posted body into a ParsedLead, or return a 400
 * Response describing the first violation. Consent must be true; email must look
 * like an email; the four pillar scores are clamped to 0-25 and overall to
 * 0-100 (computed from the pillars when missing/invalid).
 */
function parseLead(raw: unknown): ParsedLead | Response {
  if (!isPlainObject(raw)) {
    return jsonResponse({ ok: false, emailed: false, error: "Invalid request body" }, 400);
  }

  const email = normalizeText(raw.email, 320);
  if (!email || !EMAIL_RE.test(email)) {
    return jsonResponse({ ok: false, emailed: false, error: "A valid email is required" }, 400);
  }

  if (raw.consent !== true) {
    return jsonResponse({ ok: false, emailed: false, error: "Consent is required" }, 400);
  }

  if (!isPlainObject(raw.scores)) {
    return jsonResponse({ ok: false, emailed: false, error: "Scores are required" }, 400);
  }

  const pillars = {} as Record<Dimension, number>;
  for (const dim of DIMENSIONS) {
    const value = raw.scores[dim];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return jsonResponse({ ok: false, emailed: false, error: `Missing or invalid score for "${dim}"` }, 400);
    }
    pillars[dim] = Math.max(0, Math.min(25, Math.round(value)));
  }

  const rawOverall = raw.scores.overall;
  const overall = typeof rawOverall === "number" && Number.isFinite(rawOverall)
    ? Math.max(0, Math.min(100, Math.round(rawOverall)))
    : DIMENSIONS.reduce((acc, dim) => acc + pillars[dim], 0); // four /25 sum to /100

  const primaryGap: Dimension = typeof raw.primary_gap === "string" && (DIMENSIONS as string[]).includes(raw.primary_gap)
    ? (raw.primary_gap as Dimension)
    : DIMENSIONS.reduce((lowest, dim) => (pillars[dim] < pillars[lowest] ? dim : lowest), DIMENSIONS[0]);

  return {
    email,
    name: normalizeText(raw.name, 200),
    company: normalizeText(raw.company, 200),
    consent: true,
    scores: { ...pillars, overall },
    answers: isPlainObject(raw.answers) ? raw.answers : null,
    primaryGap,
    posthogDistinctId: normalizeText(raw.posthog_distinct_id, 200),
    utm: isPlainObject(raw.utm) ? raw.utm : null,
  };
}

function band(score25: number): { label: string; note: string } {
  if (score25 <= 9) return { label: "Weak", note: "this pillar is leaking trust" };
  if (score25 <= 17) return { label: "Mixed", note: "partly working, real room to improve" };
  return { label: "Strong", note: "this pillar is building trust" };
}

/** One pillar row: label, /25, a simple bar, and the band note. Deterministic. */
function pillarRow(dim: Dimension, score25: number): string {
  const pct = Math.round((score25 / 25) * 100);
  const { label, note } = band(score25);
  return `
    <tr>
      <td style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;color:${NAVY};vertical-align:top;width:140px;">
        <strong>${DIMENSION_LABELS[dim]}</strong><br/>
        <span style="font-size:12px;color:#6b7280;">${score25} / 25 — ${label}</span>
      </td>
      <td style="padding:10px 0;vertical-align:middle;">
        <div style="background:#e9edf2;border-radius:6px;height:14px;width:100%;">
          <div style="background:${GOLD};border-radius:6px;height:14px;width:${pct}%;"></div>
        </div>
        <span style="font-size:12px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(note)}</span>
      </td>
    </tr>`;
}

/** Build the on-brand Trust Gap report email (deterministic from scores). */
function buildEmailHtml(lead: ParsedLead): string {
  const { scores, primaryGap, name } = lead;
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const gapLabel = DIMENSION_LABELS[primaryGap];
  const overallBand = scores.overall <= 39 ? "Weak" : scores.overall <= 69 ? "Mixed" : "Strong";
  const rows = DIMENSIONS.map((dim) => pillarRow(dim, scores[dim])).join("");

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
            <tr>
              <td style="background:${NAVY};padding:28px 32px;">
                <h1 style="margin:0;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:22px;">Your Trust Gap&#8482; Report</h1>
                <p style="margin:8px 0 0;color:${GOLD};font-family:Arial,Helvetica,sans-serif;font-size:13px;">The IDEA Strategic Brand Framework</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;color:${NAVY};">
                <p style="margin:0 0 16px;font-size:15px;">${greeting}</p>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Here is your Trust Gap read. It shows where your brand builds trust and where it leaks it, across the four IDEA pillars.</p>

                <div style="text-align:center;margin:0 0 24px;padding:18px;background:#f4f6f9;border-radius:10px;">
                  <div style="font-size:40px;font-weight:bold;color:${NAVY};font-family:Arial,Helvetica,sans-serif;">${scores.overall}<span style="font-size:18px;color:#6b7280;">/100</span></div>
                  <div style="font-size:13px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">Overall trust score — ${overallBand}</div>
                </div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>

                <div style="margin:24px 0 0;padding:18px;border-left:4px solid ${GOLD};background:#fbf8ef;">
                  <p style="margin:0 0 6px;font-size:14px;color:${NAVY};"><strong>Your biggest opportunity: ${gapLabel}</strong></p>
                  <p style="margin:0;font-size:14px;line-height:1.5;color:${NAVY};">${gapLabel} is your weakest pillar right now, which means it is the fastest place to win back trust. Closing this gap first lifts the whole brand, so start here before the others.</p>
                </div>

                <div style="text-align:center;margin:28px 0 8px;">
                  <a href="${escapeHtml(LEAD_CTA_URL)}" style="display:inline-block;background:${GOLD};color:${NAVY};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:15px;padding:13px 28px;border-radius:8px;">See how to fix your ${gapLabel} gap</a>
                </div>

                <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">You are getting this because you ran the free Trust Gap diagnostic. Reply any time and the team will help you read your results.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Send the report via Resend. Returns true on a successful send, false on any
 * failure (lead is already captured, so a send failure is non-fatal). Logs a
 * NON-PII message on failure.
 */
async function sendReportEmail(lead: ParsedLead): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: LEAD_FROM_EMAIL,
        to: [lead.email],
        subject: "Your Trust Gap report",
        html: buildEmailHtml(lead),
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200);
      console.error(`[submit-diagnostic-lead] resend send failed | status=${response.status} | ${detail}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[submit-diagnostic-lead] resend network error:", error instanceof Error ? error.message : "unknown");
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, emailed: false, error: "Method not allowed" }, 405);
  }

  // IP rate limit (best-effort, per-isolate). The IP is used for the limiter key
  // only — it is never stored or logged.
  if (limiter.isRateLimited(`ip:${clientIp(req)}`)) {
    return new Response(
      JSON.stringify({ ok: false, emailed: false, error: "Too many requests. Please slow down and try again shortly." }),
      { status: 429, headers: { ...JSON_HEADERS, "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) } },
    );
  }

  // Bound the body before parsing.
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, emailed: false, error: "Request body too large" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, emailed: false, error: "Invalid JSON body" }, 400);
  }

  const parsed = parseLead(body);
  if (parsed instanceof Response) return parsed;

  // Insert the lead with the service-role key (RLS has no policies — the table
  // is service-role only by design).
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data, error } = await admin
    .from("leads")
    .insert({
      email: parsed.email,
      name: parsed.name,
      company: parsed.company,
      source: "free_diagnostic",
      scores: parsed.scores,
      answers: parsed.answers,
      primary_gap: parsed.primaryGap,
      overall_score: parsed.scores.overall,
      posthog_distinct_id: parsed.posthogDistinctId,
      utm: parsed.utm,
      consent: true,
      user_agent: normalizeText(req.headers.get("user-agent"), 1_000),
    })
    .select("id")
    .single();

  if (error) {
    // error.message is a Postgres/PostgREST message, not user PII.
    console.error("[submit-diagnostic-lead] insert error:", error.message);
    return jsonResponse({ ok: false, emailed: false, error: "Unable to save your details right now. Please try again." }, 500);
  }

  // The lead is captured. Email is best-effort: skip silently when unconfigured,
  // and never fail the request on a send error.
  let emailed = false;
  if (RESEND_API_KEY) {
    emailed = await sendReportEmail(parsed);
    if (emailed) {
      const { error: updateError } = await admin
        .from("leads")
        .update({ emailed_at: new Date().toISOString() })
        .eq("id", data.id);
      if (updateError) {
        // The email DID send; only the stamp failed. Non-fatal.
        console.error("[submit-diagnostic-lead] emailed_at update error:", updateError.message);
      }
    }
  }

  return jsonResponse({ ok: true, emailed }, 200);
});
