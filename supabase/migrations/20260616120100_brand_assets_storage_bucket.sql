-- ============================================
-- Brand Funnel Tracker — private storage bucket for asset screenshots
-- Path convention: {auth.uid()}/funnel/{assetId}.{ext}
-- Private bucket: the audit sends bytes to the model inline as base64 (never a public URL).
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-only access, keyed on the first path segment being the user's id.
CREATE POLICY "brand-assets read own" ON storage.objects FOR SELECT
USING (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "brand-assets insert own" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "brand-assets update own" ON storage.objects FOR UPDATE
USING (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "brand-assets delete own" ON storage.objects FOR DELETE
USING (bucket_id = 'brand-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
