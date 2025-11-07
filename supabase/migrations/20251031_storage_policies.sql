-- =====================================================
-- SnazzyAI Storage Bucket Policies
-- =====================================================

-- =====================================================
-- OUTFIT PHOTOS BUCKET POLICIES
-- =====================================================

-- Users can upload their own photos (organized by user_id folder)
CREATE POLICY "Users can upload own outfit photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'outfit-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view their own photos
CREATE POLICY "Users can view own outfit photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'outfit-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own photos
CREATE POLICY "Users can delete own outfit photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'outfit-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- TRY-ON RESULTS BUCKET POLICIES
-- =====================================================

-- Users can upload their own try-on results (organized by user_id folder)
CREATE POLICY "Users can upload own try-on results"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'try-on-results' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view their own try-on results
CREATE POLICY "Users can view own try-on results"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'try-on-results' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own try-on results
CREATE POLICY "Users can delete own try-on results"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'try-on-results' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
