-- Add openai_file_id column to track which OpenAI file corresponds to each document
ALTER TABLE public.uploaded_documents
ADD COLUMN openai_file_id TEXT;

-- Add index for faster lookups by openai_file_id
CREATE INDEX idx_uploaded_documents_openai_file_id
ON public.uploaded_documents(openai_file_id)
WHERE openai_file_id IS NOT NULL;
