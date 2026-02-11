-- Add is_visible column to npcs table
ALTER TABLE npcs ADD COLUMN is_visible BOOLEAN DEFAULT FALSE;
