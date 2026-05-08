-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    mission_date TEXT,
    participants TEXT,
    mission_id TEXT,
    description TEXT,
    status TEXT DEFAULT 'draft', -- draft, pending, accepted, rejected
    editing_by UUID REFERENCES auth.users(id), -- Null if no one is editing
    author_id UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated read access" ON public.reports
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON public.reports
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow updates for editors" ON public.reports
    FOR UPDATE TO authenticated
    USING (
        editing_by = auth.uid()
    );

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
