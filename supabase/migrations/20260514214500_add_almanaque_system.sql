-- Create almanaque_entries table
CREATE TABLE IF NOT EXISTS public.almanaque_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content JSONB DEFAULT '[]'::jsonb,
    is_public BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.almanaque_entries ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Master can do everything
CREATE POLICY "Master can do everything on almanaque_entries" 
ON public.almanaque_entries
FOR ALL 
TO authenticated 
USING (auth.jwt() ->> 'sub' = '501767960646647818')
WITH CHECK (auth.jwt() ->> 'sub' = '501767960646647818');

-- 2. Everyone (including anon) can read public entries
CREATE POLICY "Anyone can read public almanaque_entries" 
ON public.almanaque_entries
FOR SELECT 
TO public
USING (is_public = true);

-- 3. Authenticated master can read all entries (handled by policy 1, but for clarity)
-- Actually policy 1 covers SELECT for Master.

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.almanaque_entries;

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_almanaque_entries_updated_at
    BEFORE UPDATE ON public.almanaque_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
