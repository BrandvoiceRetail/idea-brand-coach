import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { anthropicApiKey, corsHeaders } from './config.ts';
import { DOCUMENT_SECTIONS } from './sections.ts';
import { generateSection } from './generate.ts';

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!anthropicApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Anthropic API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Parse request body
  let requestData: Record<string, unknown>;
  try {
    requestData = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Malformed JSON in request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const {
    sectionId,
    brandName: requestedBrandName,
    avatarFieldValues = {},
    canvas = {},
    avatar = {},
    insights = {},
    chatInsights = [],
    previousSections,
  } = requestData as {
    sectionId: string;
    brandName: string;
    avatarFieldValues: Record<string, string>;
    canvas: Record<string, string>;
    avatar: Record<string, string>;
    insights: Record<string, string>;
    chatInsights: Array<{ title: string; excerpt: string }>;
    previousSections?: Record<string, string>;
  };

  // Validate sectionId
  if (!sectionId || typeof sectionId !== 'string') {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing required field: sectionId' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const section = DOCUMENT_SECTIONS.find(s => s.id === sectionId);
  if (!section) {
    const validIds = DOCUMENT_SECTIONS.map(s => s.id).join(', ');
    return new Response(
      JSON.stringify({ success: false, error: `Invalid sectionId: "${sectionId}". Valid IDs: ${validIds}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const brandName = requestedBrandName || 'Your Brand';

  console.log(`[section] Generating section "${sectionId}" for brand "${brandName}"`);

  try {
    // Authenticate user (optional)
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let supabaseClient: ReturnType<typeof createClient> | null = null;

    if (authHeader) {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace('Bearer ', '');
      const authResult = await supabaseClient.auth.getUser(token);
      if (authResult?.data?.user?.id) {
        userId = authResult.data.user.id;
        console.log('[section] Authenticated user:', userId);
      }
    }

    // Generate the section
    const content = await generateSection(
      section,
      brandName,
      avatarFieldValues as Record<string, string>,
      canvas as Record<string, string>,
      avatar as Record<string, string>,
      insights as Record<string, string>,
      chatInsights as Array<{ title: string; excerpt: string }>,
      supabaseClient,
      userId,
      previousSections as Record<string, string> | undefined
    );

    console.log(`[section] Complete: sectionId=${sectionId}, chars=${content.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        sectionId,
        content,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[section] Error generating "${sectionId}":`, error);
    return new Response(
      JSON.stringify({
        success: false,
        sectionId,
        content: '',
        error: error.message || `Failed to generate section: ${sectionId}`,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
