// save-feedback-event — writes Moment-1 Alpha feedback to public.feedback_events.
//
// v3: merges the Alpha instrumentation spec (first-class feedback columns +
// required PostHog join key) with the v2 security posture (user_id derived
// from the VERIFIED JWT rather than trusted from the body, verify_jwt enabled
// at deploy time, payload size guard).
//
// THE JOIN KEY: posthogDistinctId is required. It connects this feedback row
// to the tester's PostHog funnel journey. Requests without it are rejected.
//
// Anonymous writes are INTENTIONALLY allowed (user_id stays null) so feedback
// is never lost if a session token is momentarily missing — the form is
// reached only on the authed /v2/coach route, so real submissions capture
// user_id. Rows are not client-readable (no SELECT policy).
//
// Body: {
//   moment?: string,                      // default 'moment_1'
//   posthogDistinctId: string,            // REQUIRED — the join key
//   avatarId?: string|null,
//   sessionId?: string|null,
//   chosenSignature?: string|null,
//   signatureOptions?: unknown[]|null,
//   scores?: object|null,
//   q1ScoreFeltRight?: 'yes'|'no'|'partial'|null,
//   q2SignatureFeltRight?: 'yes'|'no'|'partial'|null,
//   q3WhatsOff?: string|null,
//   payload?: object                      // catch-all
// }
// Returns: { id } on success, { error } otherwise.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ANSWERS = new Set(["yes", "no", "partial"]);

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeAnswer(value: unknown): string | null {
  return typeof value === "string" && VALID_ANSWERS.has(value) ? value : null;
}

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Derive the user from the caller's verified JWT — never trust a user id
    // from the request body.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();

    const body = await req.json().catch(() => ({}));

    // The join key is non-optional — without it, PostHog funnel data and this
    // feedback can never be connected.
    const posthogDistinctId = normalizeText(body?.posthogDistinctId, 200);
    if (!posthogDistinctId) {
      return jsonResponse({ error: "posthogDistinctId is required" }, 400);
    }

    const moment = normalizeText(body?.moment, 64) ?? "moment_1";
    const signatureOptions = Array.isArray(body?.signatureOptions) ? body.signatureOptions : null;
    const scores =
      body?.scores && typeof body.scores === "object" && !Array.isArray(body.scores)
        ? body.scores
        : null;
    const payload =
      body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? body.payload
        : null;

    // Guard against unbounded jsonb (storage abuse). 10KB is ample.
    for (const [field, value] of Object.entries({ signatureOptions, scores, payload })) {
      if (value !== null && JSON.stringify(value).length > 10_000) {
        return jsonResponse({ error: `${field} too large` }, 400);
      }
    }

    // Insert with the service-role key (bypasses RLS by design — the table
    // has no client INSERT policy).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data, error } = await admin
      .from("feedback_events")
      .insert({
        moment,
        user_id: user?.id ?? null,
        posthog_distinct_id: posthogDistinctId,
        avatar_id: normalizeText(body?.avatarId, 64),
        session_id: normalizeText(body?.sessionId, 200),
        chosen_signature: normalizeText(body?.chosenSignature, 2_000),
        signature_options: signatureOptions,
        scores,
        q1_score_felt_right: normalizeAnswer(body?.q1ScoreFeltRight),
        q2_signature_felt_right: normalizeAnswer(body?.q2SignatureFeltRight),
        q3_whats_off: normalizeText(body?.q3WhatsOff, 5_000),
        ...(payload !== null ? { payload } : {}),
      })
      .select("id")
      .single();

    if (error) {
      console.error("save-feedback-event insert error:", error.message);
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ id: data.id, success: true }, 200);
  } catch (err) {
    console.error("save-feedback-event error:", (err as Error)?.message ?? err);
    return jsonResponse({ error: "Failed to save feedback event" }, 500);
  }
});
