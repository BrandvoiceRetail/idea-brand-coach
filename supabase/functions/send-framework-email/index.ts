import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FrameworkEmailRequest {
  email: string;
  buyerIntent: string;
  motivation: string;
  triggers: string;
  shopperType: string;
  demographics: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, buyerIntent, motivation, triggers, shopperType, demographics }: FrameworkEmailRequest =
      await req.json();

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Trevor <noreply@app.ideabrandconsultancy.com>",
        to: [email],
        subject: "Your IDEA Framework Submission",
        html: `
          <h1>Your IDEA Framework Submission</h1>
          <p>Thank you for completing the IDEA Framework! Here are your responses:</p>
          
          <h2>Buyer Intent</h2>
          <p>${buyerIntent || "Not provided"}</p>
          
          <h2>Motivation</h2>
          <p>${motivation || "Not provided"}</p>
          
          <h2>Emotional Triggers</h2>
          <p>${triggers || "Not provided"}</p>
          
          <h2>Shopper Type</h2>
          <p>${shopperType || "Not provided"}</p>
          
          <h2>Demographics</h2>
          <p>${demographics || "Not provided"}</p>
          
          <p>Best regards,<br>The IDEA Brand Coach Team</p>
        `,
      }),
    });

    const data = await emailResponse.json();
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: emailResponse.ok ? 200 : 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-framework-email function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
