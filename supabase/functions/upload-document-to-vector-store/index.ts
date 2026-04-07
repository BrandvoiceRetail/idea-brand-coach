/**
 * upload-document-to-vector-store (pgvector edition)
 *
 * Replaces the OpenAI vector store upload pipeline with local chunking + pgvector.
 * Documents are downloaded from Supabase storage, chunked, embedded via ada-002,
 * and stored in user_knowledge_chunks for semantic search.
 *
 * Usage:
 * - { documentId: "uuid" } - Process a document from uploaded_documents table
 *
 * Flow:
 * 1. Get document metadata from uploaded_documents
 * 2. Download file from Supabase storage
 * 3. Extract text content (plain text / markdown)
 * 4. Chunk text into overlapping segments
 * 5. Generate embeddings via OpenAI ada-002 (Phase 4: Voyage AI)
 * 6. Store chunks + embeddings in user_knowledge_chunks (pgvector)
 * 7. Update uploaded_documents status
 * 8. Trigger field extraction (unchanged)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateEmbeddingsBatch } from "../_shared/embeddings.ts";
import { chunkText } from "../_shared/chunking.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface UploadRequest {
  documentId: string;
}

interface UploadedDocument {
  id: string;
  user_id: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  status: string;
  extracted_content: string | null;
}

/**
 * Extract readable text from a file blob based on mime type.
 * For PDFs and binary formats, falls back to extracted_content from the DB.
 */
async function extractText(
  blob: Blob,
  mimeType: string,
  extractedContent: string | null
): Promise<string> {
  // If we already have extracted content (from a prior extraction step), use it
  if (extractedContent && extractedContent.trim().length > 0) {
    return extractedContent;
  }

  // Plain text, markdown, CSV — read directly
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/csv'
  ) {
    return await blob.text();
  }

  // For PDFs and other binary formats, we rely on extracted_content
  // being populated by a prior processing step (document-processor function).
  // If it's not available, log a warning and return empty.
  console.warn(
    `[Extract] No extracted_content for binary mime type: ${mimeType}. ` +
    `Ensure document-processor has run first.`
  );
  return '';
}

/**
 * Map mime type / filename to a category for the knowledge chunk.
 */
function inferCategory(_filename: string, _mimeType: string): string {
  // Uploaded user documents go to "core" by default.
  // The category can be refined later based on content analysis.
  return 'core';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    let user: any = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!
      );
      const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
      if (!authError && authData?.user) {
        user = authData.user;
        console.log(`Authenticated user: ${user.id}`);
      } else {
        console.warn('Auth verification failed:', authError?.message);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const isLocalDev = supabaseUrl?.includes("kong:8000") ||
                       supabaseUrl?.includes("127.0.0.1") ||
                       supabaseUrl?.includes("localhost");

    if (!user && !isLocalDev) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Service role client ──────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { documentId }: UploadRequest = await req.json();
    if (!documentId) {
      throw new Error("documentId is required");
    }

    console.log(`Processing document: ${documentId}${user ? ` for user: ${user.id}` : ' (local dev)'}`);

    // ── Get document metadata ────────────────────────────────────────────
    let query = supabase
      .from("uploaded_documents")
      .select("*")
      .eq("id", documentId);

    if (user) {
      query = query.eq("user_id", user.id);
    }

    const { data: document, error: docError } = await query.single();
    if (docError || !document) {
      throw new Error(`Document not found or access denied: ${docError?.message || "Unknown error"}`);
    }

    const doc = document as UploadedDocument;
    console.log(`Found document: ${doc.filename} (${doc.mime_type}, ${doc.file_size} bytes)`);

    // ── Update status: uploading → processing ────────────────────────────
    await supabase
      .from("uploaded_documents")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", documentId);

    // ── Download file from storage ───────────────────────────────────────
    console.log(`Downloading file from storage: ${doc.file_path}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || "Unknown error"}`);
    }

    // ── Extract text ─────────────────────────────────────────────────────
    const text = await extractText(fileData, doc.mime_type, doc.extracted_content);
    if (!text || text.trim().length < 10) {
      // Mark as ready but with no chunks — the file exists but has no indexable content
      await supabase
        .from("uploaded_documents")
        .update({
          status: "ready",
          pgvector_indexed: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      console.warn(`Document ${doc.filename} has insufficient text content for indexing`);
      return new Response(
        JSON.stringify({
          success: true,
          documentId,
          filename: doc.filename,
          chunksCreated: 0,
          message: "Document saved but insufficient text for vector indexing",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Extracted ${text.length} chars of text from ${doc.filename}`);

    // ── Chunk text ───────────────────────────────────────────────────────
    await supabase
      .from("uploaded_documents")
      .update({ status: "indexing", updated_at: new Date().toISOString() })
      .eq("id", documentId);

    const chunks = chunkText(text, { chunkSize: 1000, overlap: 200 });
    console.log(`Split into ${chunks.length} chunks`);

    if (chunks.length === 0) {
      await supabase
        .from("uploaded_documents")
        .update({ status: "ready", pgvector_indexed: false, updated_at: new Date().toISOString() })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({ success: true, documentId, filename: doc.filename, chunksCreated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Delete any previous chunks for this document (re-indexing) ───────
    const { error: deleteError } = await supabase
      .from("user_knowledge_chunks")
      .delete()
      .eq("source_document_id", documentId);

    if (deleteError) {
      console.warn(`Failed to delete old chunks for document ${documentId}:`, deleteError);
    }

    // ── Generate embeddings in batch ─────────────────────────────────────
    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    const chunkTexts = chunks.map(c => c.content);
    const embeddings = await generateEmbeddingsBatch(chunkTexts, OPENAI_API_KEY);
    console.log(`Generated ${embeddings.length} embeddings`);

    // ── Insert chunks into pgvector ──────────────────────────────────────
    const category = inferCategory(doc.filename, doc.mime_type);
    const chunkRows = chunks.map((chunk, i) => ({
      user_id: doc.user_id,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      source_type: 'document',
      source_id: documentId,
      source_document_id: documentId,
      category,
      chunk_index: chunk.index,
      metadata: {
        filename: doc.filename,
        mime_type: doc.mime_type,
        chunk_index: chunk.index,
        total_chunks: chunks.length,
      },
    }));

    // Insert in batches of 50 to avoid payload size limits
    const BATCH_SIZE = 50;
    let insertedCount = 0;
    for (let i = 0; i < chunkRows.length; i += BATCH_SIZE) {
      const batch = chunkRows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from("user_knowledge_chunks")
        .insert(batch);

      if (insertError) {
        console.error(`Failed to insert chunk batch ${i / BATCH_SIZE}:`, insertError);
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }
      insertedCount += batch.length;
    }

    console.log(`Inserted ${insertedCount} chunks into pgvector`);

    // ── Final status update ──────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from("uploaded_documents")
      .update({
        status: "ready",
        pgvector_indexed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (updateError) {
      console.error(`Failed to update final document status: ${updateError.message}`);
    }

    console.log(`Document ${doc.filename} successfully indexed: ${insertedCount} chunks`);

    // ── Trigger field extraction (unchanged from original) ───────────────
    try {
      const extractionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-fields-from-document`;
      console.log(`Triggering automatic field extraction for document ${documentId}`);
      const extractionResponse = await fetch(extractionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId }),
      });

      if (!extractionResponse.ok) {
        const errorText = await extractionResponse.text();
        console.warn('Field extraction trigger failed:', errorText);
      } else {
        const extractionResult = await extractionResponse.json();
        console.log('Field extraction completed:', extractionResult);
      }
    } catch (err) {
      console.warn('Failed to trigger field extraction:', err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        filename: doc.filename,
        chunksCreated: insertedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in upload-document-to-vector-store:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
