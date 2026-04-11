-- Enable RLS on change_requests
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone (anon and authenticated) to insert change requests
-- This is necessary for "fake" accounts to send sheet updates for approval.
DROP POLICY IF EXISTS "Allow anyone to insert change requests" ON public.change_requests;
CREATE POLICY "Allow anyone to insert change requests" 
ON public.change_requests 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Policy: Allow anyone to view change requests
-- Master needs this to see pending requests.
DROP POLICY IF EXISTS "Allow anyone to select change requests" ON public.change_requests;
CREATE POLICY "Allow anyone to select change requests"
ON public.change_requests
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy: Only authenticated users (Master) can update status (approve/reject)
DROP POLICY IF EXISTS "Allow authenticated to update change requests" ON public.change_requests;
CREATE POLICY "Allow authenticated to update change requests"
ON public.change_requests
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
