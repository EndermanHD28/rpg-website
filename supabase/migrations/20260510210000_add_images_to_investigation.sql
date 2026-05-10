-- Add image support to investigation_cards
ALTER TABLE public.investigation_cards 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_scale FLOAT DEFAULT 1.3;

-- Relax INSERT policy for investigation_cards to allow anonymous/unauthenticated insert
-- (Matching the behavior of other relaxed policies in 20260510200000)
DROP POLICY IF EXISTS "Users can insert their own cards" ON public.investigation_cards;
DROP POLICY IF EXISTS "Anyone can insert cards" ON public.investigation_cards;
CREATE POLICY "Anyone can insert cards"
    ON public.investigation_cards FOR INSERT
    WITH CHECK (true);

-- Drop and recreate update/delete policies to ensure no hidden player_id checks
DROP POLICY IF EXISTS "Users can update any card" ON public.investigation_cards;
DROP POLICY IF EXISTS "Users can update their own cards" ON public.investigation_cards;
CREATE POLICY "Anyone can update cards"
    ON public.investigation_cards FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete any card" ON public.investigation_cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON public.investigation_cards;
CREATE POLICY "Anyone can delete cards"
    ON public.investigation_cards FOR DELETE
    USING (true);

-- Ensure global table has investigation_max_cards column
ALTER TABLE public.global
ADD COLUMN IF NOT EXISTS investigation_max_cards INTEGER DEFAULT 20;

-- Ensure an ID=1 row exists in global
INSERT INTO public.global (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
