-- Migration: Add Focus System Columns
-- Adds current_focus and max_focus_buff (optional base max) to characters and npcs.
-- Focus is a resource used by Breathing Styles.

ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS current_focus INTEGER DEFAULT 0;

ALTER TABLE npcs 
ADD COLUMN IF NOT EXISTS current_focus INTEGER DEFAULT 0;
