-- Fix default character values
ALTER TABLE public.characters
  ALTER COLUMN age SET DEFAULT 18,
  ALTER COLUMN char_name SET DEFAULT 'Novo Recruta',
  ALTER COLUMN dollars SET DEFAULT 0,
  ALTER COLUMN rank SET DEFAULT 'E - Recruta',
  ALTER COLUMN stat_points_available SET DEFAULT 0;
