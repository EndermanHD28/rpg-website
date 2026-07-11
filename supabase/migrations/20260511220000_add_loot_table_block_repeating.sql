-- Add block_repeating and replace_tries columns to loot_tables table
ALTER TABLE loot_tables 
ADD COLUMN IF NOT EXISTS block_repeating BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS replace_tries INTEGER NOT NULL DEFAULT 0;