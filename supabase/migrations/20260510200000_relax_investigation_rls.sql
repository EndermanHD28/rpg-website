-- Drop existing policies
DROP POLICY IF EXISTS "Users can update their own cards" ON public.investigation_cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON public.investigation_cards;
DROP POLICY IF EXISTS "Users can insert pins if they own one of the cards" ON public.investigation_pins;
DROP POLICY IF EXISTS "Users can delete pins if they own one of the cards" ON public.investigation_pins;

-- Create more permissive policies for cards
CREATE POLICY "Users can update any card"
    ON public.investigation_cards FOR UPDATE
    USING (true);

CREATE POLICY "Users can delete any card"
    ON public.investigation_cards FOR DELETE
    USING (true);

-- Create more permissive policies for pins
CREATE POLICY "Users can insert any pin"
    ON public.investigation_pins FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can delete any pin"
    ON public.investigation_pins FOR DELETE
    USING (true);
