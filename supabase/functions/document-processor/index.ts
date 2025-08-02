import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { documentId } = await req.json();

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Document ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing document:', documentId);

    // Get document metadata
    const { data: document, error: docError } = await supabase
      .from('uploaded_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download file');
    }

    let extractedContent = '';

    try {
      // Process different file types
      if (document.mime_type === 'text/plain') {
        // Handle plain text files
        extractedContent = await fileData.text();
      } else if (document.mime_type === 'application/pdf') {
        // For PDF files, we'll extract basic text content
        // Note: This is a simplified extraction. In production, you'd want to use a proper PDF parser
        const fileBuffer = await fileData.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        let content = decoder.decode(fileBuffer);
        
        // Try to extract readable text (basic approach)
        // Remove non-printable characters and normalize whitespace
        content = content.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
        
        if (content.length < 50) {
          extractedContent = 'PDF content extraction requires advanced processing. Please convert to text format for full content analysis.';
        } else {
          extractedContent = content;
        }
      } else if (document.mime_type.includes('document') || document.mime_type.includes('word')) {
        // For Word documents, we'll provide a placeholder
        extractedContent = 'Word document content extraction requires advanced processing. Please convert to text format for full content analysis.';
      } else {
        extractedContent = 'Unsupported file type for content extraction.';
      }

      // Limit content length to prevent database issues
      if (extractedContent.length > 50000) {
        extractedContent = extractedContent.substring(0, 50000) + '... [Content truncated for storage]';
      }

      console.log('Extracted content length:', extractedContent.length);

      // Update document with extracted content
      const { error: updateError } = await supabase
        .from('uploaded_documents')
        .update({
          extracted_content: extractedContent,
          status: 'completed'
        })
        .eq('id', documentId);

      if (updateError) {
        throw updateError;
      }

      console.log('Document processing completed successfully');

      return new Response(JSON.stringify({ 
        success: true, 
        contentLength: extractedContent.length,
        message: 'Document processed successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (contentError) {
      console.error('Content extraction error:', contentError);
      
      // Update document status to error
      await supabase
        .from('uploaded_documents')
        .update({
          status: 'error',
          extracted_content: `Processing failed: ${contentError.message}`
        })
        .eq('id', documentId);

      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Content extraction failed',
        details: contentError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in document-processor function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});