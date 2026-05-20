-- Migration: Add Weapon Type and Subtype columns to npcs table
ALTER TABLE public.npcs 
ADD COLUMN IF NOT EXISTS weapon_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS weapon_subtype TEXT DEFAULT NULL;
