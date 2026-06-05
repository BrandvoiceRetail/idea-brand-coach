// save-feedback-event — writes a moment-tagged product-signal event to public.feedback_events.
//
// Pattern mirrors the other save-* functions (service-role insert behind functions.invoke),
// with one security upgrade: user_id is derived from the VERIFIED JWT (auth.getUser) rather than
// trusted from the request body. verify_jwt is enabled at deploy time.
//
// Body: { moment: string, session_id?: string|null, payload?: object }
// Returns: { id } on success, { error } otherwise.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Derive the user from the caller's verified JWT. NOTE: anonymous writes are
    // INTENTIONALLY allowed (user_id stays null) so feedback is never lost if a session
    // token is momentarily missing — the modal is reached only on the authed /v2/coach
    // route, so real submissions capture user_id. Null-user rows are unreadable by clients
    // (RLS select-own). Abuse mitigation (per-user/IP rate limit) is a tracked follow-up.
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
    const moment = typeof body?.moment === "string" ? body.moment.trim() : "";
    if (!moment) {
      return jsonResponse({ error: "moment is required" }, 400);
    }
    if (moment.length > 64) {
      return jsonResponse({ error: "moment too long" }, 400);
    }
    const sessionId =
      typeof body?.session_id === "string" && body.session_id.trim().length > 0
        ? body.session_id
        : null;
    const payload =
      body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? body.payload
        : {};
    // Guard against unbounded jsonb (storage abuse). 10KB is ample for Moment 1 payloads.
    if (JSON.stringify(payload).length > 10_000) {
      return jsonResponse({ error: "payload too large" }, 400);
    }

    // Insert with the service-role key (bypasses RLS by design).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data, error } = await admin
      .from("feedback_events")
      .insert({
        moment,
        user_id: user?.id ?? null,
        session_id: sessionId,
        payload,
      })
      .select("id")
      .single();

    if (error) {
      console.error("save-feedback-event insert error:", error.message);
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ id: data.id }, 200);
  } catch (err) {
    console.error("save-feedback-event error:", (err as Error)?.message ?? err);
    return jsonResponse({ error: "Failed to save feedback event" }, 500);
  }
});
