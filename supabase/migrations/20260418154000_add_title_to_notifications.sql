-- Add title column to notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
