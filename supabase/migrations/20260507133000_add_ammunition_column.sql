-- Add ammunition column to characters and npcs
ALTER TABLE characters ADD COLUMN IF NOT EXISTS ammunition JSONB DEFAULT '{}'::jsonb;
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS ammunition JSONB DEFAULT '{}'::jsonb;
