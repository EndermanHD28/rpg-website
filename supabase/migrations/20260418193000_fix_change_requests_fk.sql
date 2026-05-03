-- Fix foreign key constraint on change_requests to allow secret accounts
-- Secret accounts exist in public.characters but not in auth.users

DO $$ 
BEGIN 
  -- Drop the constraint that points to auth.users
  ALTER TABLE public.change_requests DROP CONSTRAINT IF EXISTS change_requests_player_id_fkey;
  
  -- Clean up orphan records that don't exist in the characters table
  -- This prevents errors when adding the new FK constraint
  DELETE FROM public.change_requests 
  WHERE player_id NOT IN (SELECT id FROM public.characters);

  -- Add new constraint pointing to public.characters instead of auth.users
  -- This allows anyone with a character entry (including secret accounts) to create requests
  ALTER TABLE public.change_requests 
  ADD CONSTRAINT change_requests_player_id_fkey 
  FOREIGN KEY (player_id) REFERENCES public.characters(id) ON DELETE CASCADE;
END $$;
