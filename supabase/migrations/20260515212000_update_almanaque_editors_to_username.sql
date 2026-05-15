-- Update Almanaquem Editors to use Discord Usernames and refine RLS policies
-- 1. Ensure the column exists (it should from the previous migration)
ALTER TABLE public.global ADD COLUMN IF NOT EXISTS almanaque_editors TEXT[] DEFAULT '{}';

-- 2. Update RLS policies for almanaque_entries to include editors by Discord Username
-- We need to check if auth.uid() corresponds to a user whose discord_username is in the almanaque_editors array

DROP POLICY IF EXISTS "Master and Editors full access on almanaque_entries" ON public.almanaque_entries;

CREATE POLICY "Master and Editors full access on almanaque_entries" 
ON public.almanaque_entries
FOR ALL 
TO authenticated 
USING (
  (auth.uid()::text = '501767960646647818') OR 
  (EXISTS (
    SELECT 1 FROM public.characters c
    WHERE c.id = auth.uid()
    AND c.discord_username = ANY (
      SELECT unnest(almanaque_editors) FROM public.global WHERE id = 1
    )
  ))
)
WITH CHECK (
  (auth.uid()::text = '501767960646647818') OR 
  (EXISTS (
    SELECT 1 FROM public.characters c
    WHERE c.id = auth.uid()
    AND c.discord_username = ANY (
      SELECT unnest(almanaque_editors) FROM public.global WHERE id = 1
    )
  ))
);

-- Update read policy
DROP POLICY IF EXISTS "Read public almanaque_entries" ON public.almanaque_entries;

CREATE POLICY "Read public almanaque_entries" 
ON public.almanaque_entries
FOR SELECT 
TO anon, authenticated
USING (
  is_public = true OR 
  (auth.uid()::text = '501767960646647818') OR
  (EXISTS (
    SELECT 1 FROM public.characters c
    WHERE c.id = auth.uid()
    AND c.discord_username = ANY (
      SELECT unnest(almanaque_editors) FROM public.global WHERE id = 1
    )
  ))
);
