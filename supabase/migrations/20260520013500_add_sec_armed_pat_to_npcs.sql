-- Migration: Add sec_armed_pat to npcs table
ALTER TABLE public.npcs 
ADD COLUMN IF NOT EXISTS sec_armed_pat TEXT DEFAULT NULL;
