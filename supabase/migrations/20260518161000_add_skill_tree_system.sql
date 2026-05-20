-- Migration: Add Skill Tree System Columns
-- Adds ph_points and class_skills to characters and npcs tables.

ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS ph_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS class_skills JSONB DEFAULT '[]'::jsonb;

ALTER TABLE npcs 
ADD COLUMN IF NOT EXISTS ph_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS class_skills JSONB DEFAULT '[]'::jsonb;
