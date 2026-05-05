-- RLS Policies for Characters
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select characters" ON public.characters;
CREATE POLICY "Allow anyone to select characters" ON public.characters FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow anyone to upsert characters" ON public.characters;
CREATE POLICY "Allow anyone to upsert characters" ON public.characters FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select messages" ON public.messages;
CREATE POLICY "Allow anyone to select messages" ON public.messages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow anyone to insert messages" ON public.messages;
CREATE POLICY "Allow anyone to insert messages" ON public.messages FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anyone to update messages" ON public.messages;
CREATE POLICY "Allow anyone to update messages" ON public.messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anyone to delete messages" ON public.messages;
CREATE POLICY "Allow anyone to delete messages" ON public.messages FOR DELETE TO anon, authenticated USING (true);

-- RLS Policies for Global state
ALTER TABLE public.global ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select global" ON public.global;
CREATE POLICY "Allow anyone to select global" ON public.global FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow anyone to update global" ON public.global;
CREATE POLICY "Allow anyone to update global" ON public.global FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for NPCs
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select npcs" ON public.npcs;
CREATE POLICY "Allow anyone to select npcs" ON public.npcs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow anyone to all npcs" ON public.npcs;
CREATE POLICY "Allow anyone to all npcs" ON public.npcs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for Items
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select items" ON public.items;
CREATE POLICY "Allow anyone to select items" ON public.items FOR SELECT TO anon, authenticated USING (true);

-- RLS Policies for Loot Tables
ALTER TABLE public.loot_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select loot_tables" ON public.loot_tables;
CREATE POLICY "Allow anyone to select loot_tables" ON public.loot_tables FOR SELECT TO anon, authenticated USING (true);

-- RLS Policies for Loot History
ALTER TABLE public.loot_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to select loot_history" ON public.loot_history;
CREATE POLICY "Allow anyone to select loot_history" ON public.loot_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow anyone to insert loot_history" ON public.loot_history;
CREATE POLICY "Allow anyone to insert loot_history" ON public.loot_history FOR INSERT TO anon, authenticated WITH CHECK (true);

-- RLS Policies for Change Requests
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anyone to insert change requests" ON public.change_requests;
CREATE POLICY "Allow anyone to insert change requests" ON public.change_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anyone to select change requests" ON public.change_requests;
CREATE POLICY "Allow anyone to select change requests" ON public.change_requests FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow authenticated to update change requests" ON public.change_requests;
CREATE POLICY "Allow authenticated to update change requests" ON public.change_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anyone to delete change requests" ON public.change_requests;
CREATE POLICY "Allow anyone to delete change requests" ON public.change_requests FOR DELETE TO anon, authenticated USING (true);