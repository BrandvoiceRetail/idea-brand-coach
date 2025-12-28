/**
 * upload-document-to-vector-store
 *
 * Uploads a document directly to OpenAI's vector store, bypassing local text extraction.
 * OpenAI handles PDF parsing, chunking, and embedding automatically.
 *
 * Usage:
 * - { documentId: "uuid" } - Upload a document from uploaded_documents table
 *
 * Flow:
 * 1. Get document metadata from uploaded_documents
 * 2. Download file from Supabase storage
 * 3. Ensure user has vector stores (creates if needed)
 * 4. Upload file to OpenAI Files API
 * 5. Add file to user's core_store vector store
 * 6. Update uploaded_documents with openai_file_id and status
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
}

interface UserVectorStores {
  user_id: string;
  core_store_id: string;
}

/**
 * Create vector stores for user if they don't exist
 */
async function ensureUserVectorStores(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userEmail: string,
  openaiKey: string
): Promise<UserVectorStores> {
  // Check if user already has vector stores
  const { data: existing } = await supabase
    .from("user_vector_stores")
    .select("user_id, core_store_id")
    .eq("user_id", userId)
    .single();

  if (existing) {
    return existing as UserVectorStores;
  }

  // Create vector stores
  console.log(`Creating vector stores for user ${userEmail}`);

  const storeConfigs = [
    { name: `User ${userEmail} - Diagnostic`, domain: "diagnostic", field: "diagnostic_store_id" },
    { name: `User ${userEmail} - Avatar`, domain: "avatar", field: "avatar_store_id" },
    { name: `User ${userEmail} - Canvas`, domain: "canvas", field: "canvas_store_id" },
    { name: `User ${userEmail} - CAPTURE`, domain: "capture", field: "capture_store_id" },
    { name: `User ${userEmail} - Core`, domain: "core", field: "core_store_id" },
  ];

  const storeIds: Record<string, string> = { user_id: userId };

  for (const config of storeConfigs) {
    const response = await fetch("https://api.openai.com/v1/vector_stores", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
      body: JSON.stringify({
        name: config.name,
        metadata: {
          user_id: userId,
          domain: config.domain,
          scope: "user",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create ${config.domain} vector store: ${error}`);
    }

    const data = await response.json();
    storeIds[config.field] = data.id;
    console.log(`  ✅ Created ${config.domain} store: ${data.id}`);
  }

  // Save to database
  const { error: insertError } = await supabase
    .from("user_vector_stores")
    .insert(storeIds);

  if (insertError) {
    throw new Error(`Failed to save vector stores: ${insertError.message}`);
  }

  return { user_id: userId, core_store_id: storeIds.core_store_id };
}

/**
 * Upload file to OpenAI Files API
 */
async function uploadFileToOpenAI(
  apiKey: string,
  fileBlob: Blob,
  filename: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", fileBlob, filename);
  formData.append("purpose", "assistants");

  console.log(`Uploading ${filename} to OpenAI Files API...`);

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload file to OpenAI: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log(`✅ File uploaded to OpenAI: ${data.id}`);
  return data.id;
}

/**
 * Add file to OpenAI vector store and wait for it to be fully processed
 */
async function addFileToVectorStore(
  apiKey: string,
  vectorStoreId: string,
  fileId: string,
  updateStatus?: (status: string) => Promise<void>
): Promise<void> {
  console.log(`Adding file ${fileId} to vector store ${vectorStoreId}...`);

  const response = await fetch(
    `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2",
      },
      body: JSON.stringify({ file_id: fileId }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add file to vector store: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const vectorStoreFileId = data.id;
  console.log(`✅ File added to vector store with ID: ${vectorStoreFileId}, initial status: ${data.status}`);

  // Update status to "indexing"
  if (updateStatus) {
    await updateStatus("indexing");
  }

  // Poll for file processing completion (max 60 seconds)
  let attempts = 0;
  let fileStatus = data.status;

  while ((fileStatus === "in_progress" || fileStatus === "pending") && attempts < 60) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

    const statusResponse = await fetch(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${vectorStoreFileId}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "OpenAI-Beta": "assistants=v2",
        },
      }
    );

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      fileStatus = statusData.status;
      console.log(`Polling attempt ${attempts + 1}: File status is ${fileStatus}`);
    }

    attempts++;
  }

  if (fileStatus === "completed") {
    console.log(`✅ File fully processed and indexed in vector store`);
  } else if (fileStatus === "failed") {
    throw new Error(`File processing failed in vector store`);
  } else {
    console.warn(`⚠️ File processing timed out after 60 seconds, status: ${fileStatus}`);
    // Don't throw error - file might still process successfully
  }
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { documentId }: UploadRequest = await req.json();

    if (!documentId) {
      throw new Error("documentId is required");
    }

    console.log(`Processing document: ${documentId}`);

    // Get document metadata
    const { data: document, error: docError } = await supabase
      .from("uploaded_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message || "Unknown error"}`);
    }

    const doc = document as UploadedDocument;
    console.log(`Found document: ${doc.filename} (${doc.mime_type})`);

    // Get user email for vector store naming
    const { data: userData } = await supabase.auth.admin.getUserById(doc.user_id);
    const userEmail = userData?.user?.email || doc.user_id;

    // Ensure user has vector stores
    const userStores = await ensureUserVectorStores(
      supabase,
      doc.user_id,
      userEmail,
      OPENAI_API_KEY
    );

    // Download file from Supabase storage
    console.log(`Downloading file from storage: ${doc.file_path}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || "Unknown error"}`);
    }

    // Update status to "uploading"
    await supabase
      .from("uploaded_documents")
      .update({
        status: "uploading",
        updated_at: new Date().toISOString()
      })
      .eq("id", documentId);

    // Upload to OpenAI
    const openaiFileId = await uploadFileToOpenAI(
      OPENAI_API_KEY,
      fileData,
      doc.filename
    );

    // Update status to "processing"
    await supabase
      .from("uploaded_documents")
      .update({
        status: "processing",
        openai_file_id: openaiFileId,
        updated_at: new Date().toISOString()
      })
      .eq("id", documentId);

    // Create status update callback
    const updateStatus = async (status: string) => {
      await supabase
        .from("uploaded_documents")
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq("id", documentId);
    };

    // Add to vector store with status updates
    await addFileToVectorStore(
      OPENAI_API_KEY,
      userStores.core_store_id,
      openaiFileId,
      updateStatus
    );

    // Final status update to "ready"
    const { error: updateError } = await supabase
      .from("uploaded_documents")
      .update({
        status: "ready",
        openai_file_id: openaiFileId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (updateError) {
      console.error(`Failed to update final document status: ${updateError.message}`);
      // Don't throw - the file is already processed, we just failed to record it
    }

    console.log(`✅ Document ${doc.filename} successfully uploaded to vector store`);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        filename: doc.filename,
        openaiFileId,
        vectorStoreId: userStores.core_store_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in upload-document-to-vector-store:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
