-- Fix RLS Policy for almanaque_entries to ensure Master always has access
-- regardless of being in the editors list.
-- We check both auth.uid() and the discord ID in user_metadata.

DROP POLICY IF EXISTS "Master and Editors full access on almanaque_entries" ON public.almanaque_entries;

CREATE POLICY "Master and Editors full access on almanaque_entries" 
ON public.almanaque_entries
FOR ALL 
TO authenticated 
USING (
  (auth.uid()::text = '501767960646647818') OR 
  (auth.jwt() -> 'user_metadata' ->> 'sub' = '501767960646647818') OR
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
  (auth.jwt() -> 'user_metadata' ->> 'sub' = '501767960646647818') OR
  (EXISTS (
    SELECT 1 FROM public.characters c
    WHERE c.id = auth.uid()
    AND c.discord_username = ANY (
      SELECT unnest(almanaque_editors) FROM public.global WHERE id = 1
    )
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
  (auth.jwt() -> 'user_metadata' ->> 'sub' = '501767960646647818') OR
  (EXISTS (
    SELECT 1 FROM public.characters c
    WHERE c.id = auth.uid()
    AND c.discord_username = ANY (
      SELECT unnest(almanaque_editors) FROM public.global WHERE id = 1
    )
  ))
);
