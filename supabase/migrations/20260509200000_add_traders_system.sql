-- Create traders table
CREATE TABLE IF NOT EXISTS public.traders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    npc_id UUID REFERENCES public.npcs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb, -- Array of items with { item_id, price }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create trade_requests table for Master approval
CREATE TABLE IF NOT EXISTS public.trade_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES public.characters(id) ON DELETE CASCADE,
    trader_id UUID REFERENCES public.traders(id) ON DELETE CASCADE,
    item JSONB NOT NULL, -- The item being sold/offered
    value INTEGER NOT NULL, -- Offered value
    type TEXT NOT NULL CHECK (type IN ('sell', 'buy')), -- though 'buy' is usually automatic, we might use it for high value items or if master wants to oversee
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.traders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_requests ENABLE ROW LEVEL SECURITY;

-- Policies for traders
CREATE POLICY "Traders are viewable by everyone" ON public.traders
    FOR SELECT USING (true);

CREATE POLICY "Traders are manageable by authenticated users" ON public.traders
    FOR ALL USING (auth.role() = 'authenticated');

-- Policies for trade_requests
CREATE POLICY "Trade requests are viewable by everyone" ON public.trade_requests
    FOR SELECT USING (true);

CREATE POLICY "Trade requests are insertable by everyone" ON public.trade_requests
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Trade requests are manageable by authenticated users" ON public.trade_requests
    FOR ALL USING (auth.role() = 'authenticated');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.traders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_requests;
