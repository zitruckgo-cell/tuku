
/*
# Driver Document Storage Setup

Creates a public Supabase Storage bucket for driver documents (National ID, LC letter, referral).
Adds document URL columns to profiles.
Adds RLS policies so drivers can upload to their own folder and authenticated users can read.
*/

-- Create storage bucket for driver documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-docs',
  'driver-docs',
  true,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: drivers upload to their own folder
DROP POLICY IF EXISTS "drivers_upload_own_docs" ON storage.objects;
CREATE POLICY "drivers_upload_own_docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'driver-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "drivers_update_own_docs" ON storage.objects;
CREATE POLICY "drivers_update_own_docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'driver-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "authenticated_read_docs" ON storage.objects;
CREATE POLICY "authenticated_read_docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'driver-docs');

DROP POLICY IF EXISTS "drivers_delete_own_docs" ON storage.objects;
CREATE POLICY "drivers_delete_own_docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'driver-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add document URL columns to profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='national_id_doc_url') THEN
    ALTER TABLE profiles ADD COLUMN national_id_doc_url text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='lc_letter_doc_url') THEN
    ALTER TABLE profiles ADD COLUMN lc_letter_doc_url text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='referral_letter_doc_url') THEN
    ALTER TABLE profiles ADD COLUMN referral_letter_doc_url text;
  END IF;
END $$;
