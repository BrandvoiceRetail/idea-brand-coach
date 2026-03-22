-- Add extraction tracking columns to uploaded_documents
-- Tracks automatic field extraction status after document indexing

-- Add extraction status column
ALTER TABLE public.uploaded_documents
ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending'
  CHECK (extraction_status IN ('pending', 'extracting', 'completed', 'failed', 'skipped'));

-- Add extraction timing columns
ALTER TABLE public.uploaded_documents
ADD COLUMN IF NOT EXISTS extraction_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS extraction_completed_at TIMESTAMPTZ;

-- Add count of extracted fields
ALTER TABLE public.uploaded_documents
ADD COLUMN IF NOT EXISTS fields_extracted INTEGER DEFAULT 0;

-- Add extraction error message for debugging
ALTER TABLE public.uploaded_documents
ADD COLUMN IF NOT EXISTS extraction_error TEXT;

-- Add avatar_id to link documents to specific avatars
ALTER TABLE public.uploaded_documents
ADD COLUMN IF NOT EXISTS avatar_id UUID REFERENCES public.avatars(id) ON DELETE SET NULL;

-- Index for querying documents ready for extraction
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_extraction_status
ON public.uploaded_documents (extraction_status, status);

-- Index for querying documents by avatar
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_avatar_id
ON public.uploaded_documents (avatar_id)
WHERE avatar_id IS NOT NULL;

-- Enable realtime for field extraction updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.uploaded_documents;
