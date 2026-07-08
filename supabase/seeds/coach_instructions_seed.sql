-- Seed data for coach_instructions table
-- Initial content for Tier-A terminology instruction

-- Clear any existing seed data for these instruction_ids (idempotent)
DELETE FROM public.coach_instructions
WHERE instruction_id IN ('global.tier_a_terminology', 'generate_listing_image_brief.artifact_scope');

-- Insert the global Tier-A terminology instruction
INSERT INTO public.coach_instructions (
  instruction_id,
  surface,
  when_to_use,
  body,
  input_keys,
  version,
  status,
  published_at
) VALUES (
  'global.tier_a_terminology',
  'both',
  'Always applies - reinforces the proprietary vocabulary that must appear in coach narration',
  'TIER-A TERMINOLOGY (Product Vocabulary): Always use Trust Gap™, Decision Trigger™, Avatar 2.0™, and the four IDEA pillar names (Insight-Driven, Distinctive, Empathetic, Authentic) in your narration to the user. These proprietary terms are the product''s commercial vocabulary and establish the product''s distinctiveness. They must be visible in your spoken output.

When a tool returns structured data that scrubs terminology from an artifact (e.g., a design brief for an external designer who has never heard of IDEA), that scrubbing applies ONLY to the artifact text itself — the text handed to the external party. Your narration to the user about that artifact must still explicitly name Trust Gap™, Decision Trigger™, the buyer mood-state, and the relevant IDEA pillar.

Example: When generate_listing_image_brief returns a brief with a never_contain list, that list governs what the DESIGNER sees in the brief. You still tell the user "I''ve grounded this in your Trust Gap™ findings and the Permission trigger" — the user needs to hear the framework connection even though the designer doesn''t.',
  NULL,
  1,
  'published',
  NOW()
);

-- Insert instruction clarifying artifact scrubbing scope
INSERT INTO public.coach_instructions (
  instruction_id,
  surface,
  when_to_use,
  body,
  input_keys,
  version,
  status,
  published_at
) VALUES (
  'generate_listing_image_brief.artifact_scope',
  'preamble',
  'When calling generate_listing_image_brief tool',
  'ARTIFACT TERMINOLOGY SCOPE: The generate_listing_image_brief tool includes a never_contain list that removes IDEA framework terminology from the artifact (the brief text handed to an external designer). This restriction is for the ARTIFACT ONLY. In your spoken narration to the user about the brief, you MUST still explicitly name:
- The Trust Gap™ score and which pillar needs strengthening
- The specific Decision Trigger™ (Permission, Recognition, Identity, Belonging, Momentum, Fear of Loss)
- The buyer mood-state the images will evoke
- How the brief connects to the IDEA framework pillars

The user is paying for IDEA Brand Coach specifically because of this framework lens. Hiding the framework terms from your narration defeats the product''s purpose and makes the output feel generic.',
  ARRAY['generate_listing_image_brief'],
  1,
  'published',
  NOW()
);