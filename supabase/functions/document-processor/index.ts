import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // AuthN: identify the caller from their JWT; ALL data access is scoped to this user_id.
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: "Document ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role for storage + DB work, but EVERY query is constrained to the caller's user_id,
    // so a forged documentId cannot read or mutate another tenant's row (closes the IDOR).
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: document, error: docError } = await supabase
      .from("uploaded_documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (docError || !document) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(document.file_path);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extractedContent = "";
    try {
      if (document.mime_type === "text/plain") {
        extractedContent = await fileData.text();
      } else if (document.mime_type === "application/pdf") {
        const fileBuffer = await fileData.arrayBuffer();
        let content = new TextDecoder("utf-8").decode(fileBuffer)
          .replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
        extractedContent = content.length < 50
          ? "PDF content extraction requires advanced processing. Please convert to text format for full content analysis."
          : content;
      } else if (document.mime_type?.includes("document") || document.mime_type?.includes("word")) {
        extractedContent = "Word document content extraction requires advanced processing. Please convert to text format for full content analysis.";
      } else {
        extractedContent = "Unsupported file type for content extraction.";
      }

      if (extractedContent.length > 50000) {
        extractedContent = extractedContent.substring(0, 50000) + "... [Content truncated for storage]";
      }

      const { error: updateError } = await supabase
        .from("uploaded_documents")
        .update({ extracted_content: extractedContent, status: "completed" })
        .eq("id", documentId)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, contentLength: extractedContent.length, message: "Document processed successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (contentError) {
      console.error("Content extraction error:", contentError);
      await supabase
        .from("uploaded_documents")
        .update({ status: "error", extracted_content: "Processing failed" })
        .eq("id", documentId)
        .eq("user_id", user.id);
      return new Response(JSON.stringify({ success: false, error: "Content extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error in document-processor function:", error);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
