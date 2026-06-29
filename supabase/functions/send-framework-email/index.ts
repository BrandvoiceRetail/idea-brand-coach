import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Neutralize any markup injected via user-provided fields.
function esc(s: unknown): string {
  return String(s ?? "Not provided")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // AuthN: require a valid Supabase session. The recipient is ALWAYS the authenticated
    // user's own email — this is not a general-purpose mailer (prevents open-relay abuse).
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { buyerIntent, motivation, triggers, shopperType, demographics } = await req.json();
    const to = user.email; // never a caller-supplied address

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Trevor <noreply@app.ideabrandconsultancy.com>",
        to: [to],
        subject: "Your IDEA Framework Submission",
        html: `
          <h1>Your IDEA Framework Submission</h1>
          <p>Thank you for completing the IDEA Framework! Here are your responses:</p>
          <h2>Buyer Intent</h2><p>${esc(buyerIntent)}</p>
          <h2>Motivation</h2><p>${esc(motivation)}</p>
          <h2>Emotional Triggers</h2><p>${esc(triggers)}</p>
          <h2>Shopper Type</h2><p>${esc(shopperType)}</p>
          <h2>Demographics</h2><p>${esc(demographics)}</p>
          <p>Best regards,<br>The IDEA Brand Coach Team</p>
        `,
      }),
    });

    const ok = emailResponse.ok;
    if (!ok) console.error("Resend error status:", emailResponse.status);
    return new Response(JSON.stringify({ success: ok }), {
      status: ok ? 200 : 502,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error in send-framework-email function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
