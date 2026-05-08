-- Migration: Add Breathing System Columns
-- Adds breathing_points and breathing_skills to characters and npcs tables.

ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS breathing_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS breathing_skills JSONB DEFAULT '[]'::jsonb;

ALTER TABLE npcs 
ADD COLUMN IF NOT EXISTS breathing_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS breathing_skills JSONB DEFAULT '[]'::jsonb;

-- Note: breathing_style column already exists in characters and npcs (verified via code inspection)
