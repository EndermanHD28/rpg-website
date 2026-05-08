-- Fix Foreign Key constraints in the reports table to allow Fake Users (Secret Accounts)
-- Fake users have UUIDs that don't exist in auth.users, so we point the constraints to public.characters or remove them.

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_editing_by_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_author_id_fkey;

-- We don't necessarily need to add new constraints if we want maximum flexibility,
-- but adding them to public.characters (where both real and fake users have entries) is better.

ALTER TABLE public.reports 
ADD CONSTRAINT reports_editing_by_fkey 
FOREIGN KEY (editing_by) REFERENCES public.characters(id) ON DELETE SET NULL;

ALTER TABLE public.reports 
ADD CONSTRAINT reports_author_id_fkey 
FOREIGN KEY (author_id) REFERENCES public.characters(id) ON DELETE CASCADE;
