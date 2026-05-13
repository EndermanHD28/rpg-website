-- Allow anonymous users to create and update their own "fake" characters
-- Fake characters are identified by a specific UUID prefix: 00000000-0000-4000-8000-

-- 1. Insert Policy for Anon
DROP POLICY IF EXISTS "Allow anon to insert fake characters" ON public.characters;
CREATE POLICY "Allow anon to insert fake characters" ON public.characters
FOR INSERT TO anon
WITH CHECK (id::text LIKE '00000000-0000-4000-8000-%');

-- 2. Update Policy for Anon
DROP POLICY IF EXISTS "Allow anon to update fake characters" ON public.characters;
CREATE POLICY "Allow anon to update fake characters" ON public.characters
FOR UPDATE TO anon
USING (id::text LIKE '00000000-0000-4000-8000-%')
WITH CHECK (id::text LIKE '00000000-0000-4000-8000-%');

-- 3. Delete Policy for Anon (Optional, but helps for cleanup)
DROP POLICY IF EXISTS "Allow anon to delete fake characters" ON public.characters;
CREATE POLICY "Allow anon to delete fake characters" ON public.characters
FOR DELETE TO anon
USING (id::text LIKE '00000000-0000-4000-8000-%');
