-- Create investigation_cards table
CREATE TABLE IF NOT EXISTS public.investigation_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nova Evidência',
    content TEXT DEFAULT '',
    x_pos FLOAT DEFAULT 100,
    y_pos FLOAT DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create investigation_pins table (for the lines/connections)
CREATE TABLE IF NOT EXISTS public.investigation_pins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_card_id UUID REFERENCES public.investigation_cards(id) ON DELETE CASCADE,
    to_card_id UUID REFERENCES public.investigation_cards(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(from_card_id, to_card_id)
);

-- Enable RLS
ALTER TABLE public.investigation_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_pins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for investigation_cards
CREATE POLICY "Users can view all cards" 
    ON public.investigation_cards FOR SELECT 
    USING (true);

CREATE POLICY "Users can insert their own cards" 
    ON public.investigation_cards FOR INSERT 
    WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update their own cards" 
    ON public.investigation_cards FOR UPDATE 
    USING (auth.uid() = player_id);

CREATE POLICY "Users can delete their own cards" 
    ON public.investigation_cards FOR DELETE 
    USING (auth.uid() = player_id);

-- RLS Policies for investigation_pins
CREATE POLICY "Users can view all pins" 
    ON public.investigation_pins FOR SELECT 
    USING (true);

CREATE POLICY "Users can insert pins if they own one of the cards" 
    ON public.investigation_pins FOR INSERT 
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.investigation_cards WHERE id = from_card_id AND player_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.investigation_cards WHERE id = to_card_id AND player_id = auth.uid())
    );

CREATE POLICY "Users can delete pins if they own one of the cards" 
    ON public.investigation_pins FOR DELETE 
    USING (
        EXISTS (SELECT 1 FROM public.investigation_cards WHERE id = from_card_id AND player_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.investigation_cards WHERE id = to_card_id AND player_id = auth.uid())
    );

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_investigation_cards_updated_at
    BEFORE UPDATE ON public.investigation_cards
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();
