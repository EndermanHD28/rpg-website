-- Fix RLS Policies for almanaque_entries
DROP POLICY IF EXISTS "Master can do everything on almanaque_entries" ON public.almanaque_entries;
DROP POLICY IF EXISTS "Anyone can read public almanaque_entries" ON public.almanaque_entries;

-- 1. Master Policy (using project's style)
CREATE POLICY "Master full access on almanaque_entries" 
ON public.almanaque_entries
FOR ALL 
TO authenticated 
USING (auth.uid()::text = '501767960646647818')
WITH CHECK (auth.uid()::text = '501767960646647818');

-- 2. Read Policy for everyone (Public entries)
CREATE POLICY "Read public almanaque_entries" 
ON public.almanaque_entries
FOR SELECT 
TO anon, authenticated
USING (is_public = true OR auth.uid()::text = '501767960646647818');

-- Grant permissions explicitly just in case
GRANT ALL ON public.almanaque_entries TO authenticated;
GRANT SELECT ON public.almanaque_entries TO anon;
