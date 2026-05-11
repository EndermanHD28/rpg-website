-- Add optional description to investigation_cards for images
ALTER TABLE public.investigation_cards 
ADD COLUMN IF NOT EXISTS description TEXT;
