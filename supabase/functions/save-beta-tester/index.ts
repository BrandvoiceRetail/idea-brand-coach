import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { name, email, company, overallScore, categoryScores } = await req.json();

    console.log("Saving beta tester data:", { name, email, company, overallScore });

    const { data, error } = await supabase
      .from("beta_testers")
      .insert({
        name: name || null,
        email: email || null,
        company: company || null,
        overall_score: overallScore,
        category_scores: categoryScores,
        diagnostic_completion_date: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error("Error saving beta tester:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Beta tester saved successfully:", data);

    // Send email with diagnostic results if email is provided
    if (email) {
      try {
        console.log("Sending diagnostic results email to:", email);

        // Create category scores display
        let categoryScoresHTML = "";
        if (categoryScores && typeof categoryScores === "object") {
          categoryScoresHTML = Object.entries(categoryScores)
            .map(
              ([category, score]) =>
                `<li><strong>${category.charAt(0).toUpperCase() + category.slice(1)}:</strong> ${score}%</li>`,
            )
            .join("");
        }

        const emailHTML = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; text-align: center;">Your Diagnostic Results</h1>
            
            <p>Hello ${name || "there"},</p>
            
            <p>Thank you for participating in our beta testing program! Here are your diagnostic results:</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #333; margin-top: 0;">Overall Score</h2>
              <p style="font-size: 24px; font-weight: bold; color: #2563eb; margin: 10px 0;">${overallScore}%</p>
            </div>
            
            ${
              categoryScoresHTML
                ? `
              <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #333; margin-top: 0;">Category Breakdown</h2>
                <ul style="list-style-type: none; padding: 0;">
                  ${categoryScoresHTML}
                </ul>
              </div>
            `
                : ""
            }
            
            <div style="margin-top: 30px; padding: 20px; border-left: 4px solid #2563eb; background-color: #f8fafc;">
              <h3 style="color: #333; margin-top: 0;">What's Next?</h3>
              <p>Your feedback is invaluable to us. We'll be in touch soon with updates and improvements based on your testing experience.</p>
              ${company ? `<p><strong>Company:</strong> ${company}</p>` : ""}
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 14px;">Thank you for helping us improve our product!</p>
            </div>
          </div>
        `;

        const getResponse = await resend.emails.send({
          from: "Trevor <noreply@app.ideabrandconsultancy.com>",
          to: [email],
          subject: `Your Diagnostic Results - ${overallScore}% Overall Score`,
          html: emailHTML,
        });
        data.emailSend = getResponse;
        console.log("Diagnostic results email sent successfully");
      } catch (emailError) {
        console.error("Error sending diagnostic results email:", emailError);
        // Don't fail the entire request if email fails
      }
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in save-beta-tester function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
