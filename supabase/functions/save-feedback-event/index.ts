import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// save-feedback-event — writes Moment-1 Alpha feedback to feedback_events.
// Cloned from the save-beta-feedback pattern (no-JWT public write path).
//
// THE JOIN KEY: posthogDistinctId is required. It connects this feedback row
// to the tester's PostHog funnel journey. Requests without it are rejected.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_ANSWERS = new Set(['yes', 'no', 'partial'])

function normalizeAnswer(value: unknown): string | null {
  return typeof value === 'string' && VALID_ANSWERS.has(value) ? value : null
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
      moment,
      userId,
      posthogDistinctId,
      avatarId,
      sessionId,
      chosenSignature,
      signatureOptions,
      scores,
      q1ScoreFeltRight,
      q2SignatureFeltRight,
      q3WhatsOff,
      payload,
    } = await req.json()

    // The join key is non-optional — without it, PostHog funnel data and this
    // feedback can never be connected.
    if (typeof posthogDistinctId !== 'string' || posthogDistinctId.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'posthogDistinctId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Saving feedback event:', {
      moment: moment || 'moment_1',
      hasUserId: !!userId,
      hasAvatarId: !!avatarId,
      optionCount: Array.isArray(signatureOptions) ? signatureOptions.length : 0,
    })

    const { data, error } = await supabase
      .from('feedback_events')
      .insert({
        moment: moment || 'moment_1',
        user_id: userId || null,
        posthog_distinct_id: posthogDistinctId.trim(),
        avatar_id: avatarId || null,
        session_id: sessionId || null,
        chosen_signature: chosenSignature || null,
        signature_options: signatureOptions ?? null,
        scores: scores ?? null,
        q1_score_felt_right: normalizeAnswer(q1ScoreFeltRight),
        q2_signature_felt_right: normalizeAnswer(q2SignatureFeltRight),
        q3_whats_off: q3WhatsOff || null,
        payload: payload ?? null,
      })
      .select()

    if (error) {
      console.error('Error saving feedback event:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Feedback event saved successfully:', data?.[0]?.id)

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in save-feedback-event function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
