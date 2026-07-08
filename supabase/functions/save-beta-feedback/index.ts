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

    // Derive the user from the VERIFIED JWT — never trust a userId from the body
    // (that would let any caller attribute feedback to an arbitrary user). Anonymous
    // feedback is still allowed (user_id stays null); the widget can be used pre-auth.
    const authHeader = req.headers.get('Authorization') ?? ''
    let authedUserId: string | null = null
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user } } = await userClient.auth.getUser()
      authedUserId = user?.id ?? null
    }

    const requestData = await req.json()

    // Check if this is a quick feedback from the widget or full feedback form
    const isQuickFeedback = 'quickFeedback' in requestData

    if (isQuickFeedback) {
      // Handle quick feedback from the widget. Anonymous testers may attach an
      // optional contact email + an explicit email-marketing opt-in.
      const { quickFeedback, pageUrl, feedbackType, timestamp, email, emailOptIn } = requestData
      const contactEmail = typeof email === 'string' && email.trim().length > 0 ? email.trim().slice(0, 320) : null

      // MF-5: no PII/content in logs — shape only.
      console.log('Saving quick beta feedback:', { feedbackType, hasUser: !!authedUserId, hasEmail: !!contactEmail })

      // Store quick feedback in step_comments field with special formatting
      const { error } = await supabase
        .from('beta_feedback')
        .insert({
          user_id: authedUserId,
          contact_email: contactEmail,
          // Consent only means something when given alongside an email.
          email_opt_in: contactEmail ? emailOptIn === true : null,
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

      if (error) {
        console.error('Error saving quick beta feedback:', error.message)
        return new Response(
          JSON.stringify({ error: 'Unable to save feedback. Please try again.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
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
      betaTesterId,
      stepComments
    } = requestData

    // MF-5: no PII/content in logs — counts/shape only.
    console.log('Saving beta feedback:', {
      overallRating,
      hasUser: !!authedUserId,
      areasCount: selectedAreas?.length,
      stepCommentsCount: stepComments?.length || 0
    })

    const { error } = await supabase
      .from('beta_feedback')
      .insert({
        user_id: authedUserId,
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

    if (error) {
      console.error('Error saving beta feedback:', error.message)
      return new Response(
        JSON.stringify({ error: 'Unable to save feedback. Please try again.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
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
