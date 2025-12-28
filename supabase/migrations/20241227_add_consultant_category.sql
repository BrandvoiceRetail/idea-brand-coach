-- Add 'consultant' to the allowed categories for user_knowledge_base
-- This is needed for IDEA Framework Consultant session persistence

-- Drop the existing constraint
ALTER TABLE public.user_knowledge_base
DROP CONSTRAINT IF EXISTS user_knowledge_base_category_check;

-- Add the constraint with 'consultant' included
ALTER TABLE public.user_knowledge_base
ADD CONSTRAINT user_knowledge_base_category_check
CHECK (category IN ('diagnostic', 'avatar', 'insights', 'canvas', 'copy', 'capture', 'core', 'consultant'));

-- Comment explaining the category usage:
-- consultant → Used for IDEA Framework Consultant session-specific field persistence
COMMENT ON COLUMN public.user_knowledge_base.category IS 'Category of knowledge: diagnostic, avatar, insights, canvas, copy, capture, core, consultant';