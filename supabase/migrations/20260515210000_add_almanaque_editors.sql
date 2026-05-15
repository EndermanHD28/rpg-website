-- Add Almanaquem Editors to global settings and update RLS policies
-- 1. Add column to global table to store editor IDs (Discord IDs / Auth IDs)
ALTER TABLE public.global ADD COLUMN IF NOT EXISTS almanaque_editors TEXT[] DEFAULT '{}';

-- 2. Update RLS policies for almanaque_entries to include editors
-- We need to check if auth.uid() is in the almanaque_editors array OR is the Master ID

DROP POLICY IF EXISTS "Master full access on almanaque_entries" ON public.almanaque_entries;

CREATE POLICY "Master and Editors full access on almanaque_entries" 
ON public.almanaque_entries
FOR ALL 
TO authenticated 
USING (
  (auth.uid()::text = '501767960646647818') OR 
  (auth.uid()::text = ANY (
    SELECT unnest(almanaque_editors) FROM public.global WHERE id = 1
  ))
)
WITH CHECK (
  (auth.uid()::text = '501767960646647818') OR 
  (auth.uid()::text = ANY (
    SELECT unnest(almanaque_editors) FROM public.global WHERE id = 1
  ))
);

-- Update read policy as well
DROP POLICY IF EXISTS "Read public almanaque_entries" ON public.almanaque_entries;

CREATE POLICY "Read public almanaque_entries" 
ON public.almanaque_entries
FOR SELECT 
TO anon, authenticated
USING (
  is_public = true OR 
  (auth.uid()::text = '501767960646647818') OR
  (auth.uid()::text = ANY (
    SELECT unnest(almanaque_editors) FROM public.global WHERE id = 1
  ))
);
