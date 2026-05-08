-- Fix RLS policies for reports to allow updates during editing
-- We use a more permissive policy for authenticated users since the application logic handles the single-editor lock
DROP POLICY IF EXISTS "Allow updates for editors" ON public.reports;

CREATE POLICY "Allow authenticated updates" ON public.reports
    FOR UPDATE TO authenticated
    USING (true);

-- Also allow deletes for authenticated (for discarding new drafts)
CREATE POLICY "Allow authenticated deletes" ON public.reports
    FOR DELETE TO authenticated
    USING (true);
