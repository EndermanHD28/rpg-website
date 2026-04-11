-- Drop the foreign key constraint that requires characters to be real auth users
-- This allows "fake" accounts created for testing to exist in the characters table.
ALTER TABLE public.characters 
DROP CONSTRAINT IF EXISTS characters_id_fkey;
