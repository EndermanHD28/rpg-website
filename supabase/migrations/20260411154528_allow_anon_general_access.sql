-- This migration ensures that unauthenticated "fake" users can still interact with the database
-- as required by the new testing/fake account system.

-- Characters: allow select and all (for upsert)
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select characters" ON public.characters;
CREATE POLICY "Allow anyone to select characters" ON public.characters FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow anyone to upsert characters" ON public.characters;
CREATE POLICY "Allow anyone to upsert characters" ON public.characters FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Messages: allow select and insert
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select messages" ON public.messages;
CREATE POLICY "Allow anyone to select messages" ON public.messages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow anyone to insert messages" ON public.messages;
CREATE POLICY "Allow anyone to insert messages" ON public.messages FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Global state: allow select
ALTER TABLE public.global ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select global" ON public.global;
CREATE POLICY "Allow anyone to select global" ON public.global FOR SELECT TO anon, authenticated USING (true);

-- NPCs: allow select
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select npcs" ON public.npcs;
CREATE POLICY "Allow anyone to select npcs" ON public.npcs FOR SELECT TO anon, authenticated USING (true);

-- Items: allow select
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select items" ON public.items;
CREATE POLICY "Allow anyone to select items" ON public.items FOR SELECT TO anon, authenticated USING (true);

-- Loot Tables: allow select
ALTER TABLE public.loot_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select loot_tables" ON public.loot_tables;
CREATE POLICY "Allow anyone to select loot_tables" ON public.loot_tables FOR SELECT TO anon, authenticated USING (true);

-- Loot History: allow select and insert
ALTER TABLE public.loot_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select loot_history" ON public.loot_history;
CREATE POLICY "Allow anyone to select loot_history" ON public.loot_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow anyone to insert loot_history" ON public.loot_history;
CREATE POLICY "Allow anyone to insert loot_history" ON public.loot_history FOR INSERT TO anon, authenticated WITH CHECK (true);
