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

    const requestData = await req.json()

    // Check if this is a quick feedback from the widget or full feedback form
    const isQuickFeedback = 'quickFeedback' in requestData

    if (isQuickFeedback) {
      // Handle quick feedback from the widget
      const { quickFeedback, pageUrl, feedbackType, userId, timestamp } = requestData

      console.log('Saving quick beta feedback:', {
        feedbackType,
        pageUrl,
        userId,
        timestamp
      })

      // Store quick feedback in step_comments field with special formatting
      const { data, error } = await supabase
        .from('beta_feedback')
        .insert({
          user_id: userId || null,
          step_comments: [{
            stepId: `widget-${feedbackType}`,
            pageUrl: pageUrl,
            comment: quickFeedback,
            timestamp: timestamp
          }],
          // Mark this as widget feedback for easy filtering
          issues: feedbackType === 'bug' ? quickFeedback : null,
          improvements: feedbackType === 'idea' ? quickFeedback : null,
          liked_most: feedbackType === 'general' ? quickFeedback : null
        })
        .select()

      if (error) {
        console.error('Error saving quick beta feedback:', error)
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log('Quick beta feedback saved successfully:', data)

      return new Response(
        JSON.stringify({ success: true, data }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Handle full feedback form submission (existing logic)
    const {
      overallRating,
      likedMost,
      improvements,
      issues,
      selectedAreas,
      wouldRecommend,
      email,
      userId,
      betaTesterId,
      stepComments
    } = requestData

    console.log('Saving beta feedback:', {
      overallRating,
      userId,
      betaTesterId,
      areasCount: selectedAreas?.length,
      stepCommentsCount: stepComments?.length || 0
    })

    const { data, error } = await supabase
      .from('beta_feedback')
      .insert({
        user_id: userId || null,
        beta_tester_id: betaTesterId || null,
        overall_rating: overallRating ? parseInt(overallRating) : null,
        liked_most: likedMost || null,
        improvements: improvements || null,
        issues: issues || null,
        areas_tested: selectedAreas || [],
        would_recommend: wouldRecommend || null,
        contact_email: email || null,
        step_comments: stepComments || []
      })
      .select()

    if (error) {
      console.error('Error saving beta feedback:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Beta feedback saved successfully:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in save-beta-feedback function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})