-- Add blocked_tabs column to global table
ALTER TABLE public.global ADD COLUMN IF NOT EXISTS blocked_tabs TEXT[] DEFAULT '{}';
