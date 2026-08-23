-- Add task_flows column to global table for storing master task flow playlists
ALTER TABLE public.global 
ADD COLUMN IF NOT EXISTS task_flows JSONB DEFAULT '[]'::jsonb;