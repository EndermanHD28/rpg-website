-- Secure RLS Policies for Game Data
-- This migration hard-restricts updates to the owner or the Master.

-- 1. CHARACTERS
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- Select: Anyone can view characters
DROP POLICY IF EXISTS "Allow anyone to select characters" ON public.characters;
CREATE POLICY "Allow anyone to select characters" ON public.characters FOR SELECT TO anon, authenticated USING (true);

-- Update: Only owner or Master
DROP POLICY IF EXISTS "Allow anyone to upsert characters" ON public.characters;
DROP POLICY IF EXISTS "Characters update policy" ON public.characters;
CREATE POLICY "Characters update policy" ON public.characters 
FOR UPDATE TO authenticated 
USING (
  auth.uid() = id OR 
  auth.uid()::text = '501767960646647818'
)
WITH CHECK (
  auth.uid() = id OR 
  auth.uid()::text = '501767960646647818'
);

-- Insert: Users can create their own character, or Master can create any
DROP POLICY IF EXISTS "Characters insert policy" ON public.characters;
CREATE POLICY "Characters insert policy" ON public.characters
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = id OR 
  auth.uid()::text = '501767960646647818'
);


-- 2. NPCs
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select npcs" ON public.npcs;
CREATE POLICY "Allow anyone to select npcs" ON public.npcs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anyone to all npcs" ON public.npcs;
DROP POLICY IF EXISTS "NPCs all policy" ON public.npcs;
CREATE POLICY "NPCs all policy" ON public.npcs 
FOR ALL TO authenticated 
USING (
  true
)
WITH CHECK (
  true
);


-- 3. GLOBAL STATE
ALTER TABLE public.global ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select global" ON public.global;
CREATE POLICY "Allow anyone to select global" ON public.global FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anyone to update global" ON public.global;
DROP POLICY IF EXISTS "Global update policy" ON public.global;
CREATE POLICY "Global update policy" ON public.global 
FOR UPDATE TO authenticated 
USING (
  auth.uid()::text = '501767960646647818'
)
WITH CHECK (
  auth.uid()::text = '501767960646647818'
);
