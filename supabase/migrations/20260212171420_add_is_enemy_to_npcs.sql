-- Add is_enemy field to NPCs table
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS is_enemy BOOLEAN DEFAULT false;
