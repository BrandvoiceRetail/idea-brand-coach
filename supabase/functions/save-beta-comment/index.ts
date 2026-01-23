import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const {
      stepId,
      pageUrl,
      comment,
      timestamp,
      userId,
      betaTesterId
    } = await req.json()

    console.log('Saving beta comment:', {
      stepId,
      pageUrl,
      userId,
      betaTesterId
    })

    const { data, error } = await supabase
      .from('beta_comments')
      .insert({
        user_id: userId || null,
        beta_tester_id: betaTesterId || null,
        step_id: stepId,
        page_url: pageUrl,
        comment: comment,
        commented_at: timestamp || new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('Error saving beta comment:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Beta comment saved successfully:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in save-beta-comment function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
