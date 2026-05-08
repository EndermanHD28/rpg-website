-- Add policies for anon role to reports table to allow fake users to interact
-- Fake users share the anon key but are managed via application-level IDs

DO $$
BEGIN
    -- SELECT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'reports' AND policyname = 'Allow anon read access'
    ) THEN
        CREATE POLICY "Allow anon read access" ON public.reports
            FOR SELECT TO anon USING (true);
    END IF;

    -- INSERT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'reports' AND policyname = 'Allow anon insert'
    ) THEN
        CREATE POLICY "Allow anon insert" ON public.reports
            FOR INSERT TO anon WITH CHECK (true);
    END IF;

    -- UPDATE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'reports' AND policyname = 'Allow anon updates'
    ) THEN
        CREATE POLICY "Allow anon updates" ON public.reports
            FOR UPDATE TO anon USING (true);
    END IF;

    -- DELETE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'reports' AND policyname = 'Allow anon deletes'
    ) THEN
        CREATE POLICY "Allow anon deletes" ON public.reports
            FOR DELETE TO anon USING (true);
    END IF;
END
$$;
