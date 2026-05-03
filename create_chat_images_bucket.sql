-- Create the storage bucket for chat images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_images', 'chat_images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS for the chat_images bucket
-- Note: storage.objects RLS depends on the bucket_id

-- 1. Allow anyone to view images (Public bucket)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'chat_images');

-- 2. Allow anyone to upload images
DROP POLICY IF EXISTS "Allow Upload" ON storage.objects;
CREATE POLICY "Allow Upload" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'chat_images');

-- 3. Allow anyone to delete images (needed for the "cleanup" logic in CombatLog.js)
DROP POLICY IF EXISTS "Allow Delete" ON storage.objects;
CREATE POLICY "Allow Delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'chat_images');
