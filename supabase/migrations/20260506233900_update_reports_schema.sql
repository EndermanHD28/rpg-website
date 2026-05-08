-- Update reports table for new requirements
ALTER TABLE public.reports RENAME COLUMN participants TO author_name;
ALTER TABLE public.reports ADD COLUMN unit_id TEXT;

-- Update existing records mission_id if they are empty
UPDATE public.reports SET mission_id = 'MIS-0000' WHERE mission_id IS NULL;
