-- Add missing character-like fields to npcs table to support "Complex" NPC types
ALTER TABLE public.npcs
ADD COLUMN IF NOT EXISTS age integer,
ADD COLUMN IF NOT EXISTS anomalies text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS bloodline text,
ADD COLUMN IF NOT EXISTS breathing_lvl integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS breathing_style text,
ADD COLUMN IF NOT EXISTS charisma integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS class text,
ADD COLUMN IF NOT EXISTS dollars integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS height text,
ADD COLUMN IF NOT EXISTS intelligence integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS inventory jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS luck integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS nichirin_color text,
ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stat_points_available integer DEFAULT 0;

-- Ensure type exists (it was already in supabase.ts but let's be safe)
-- ALTER TABLE public.npcs ADD COLUMN IF NOT EXISTS type text DEFAULT 'Simple';
-- Actually, according to supabase.ts, it already has "type: string | null"
