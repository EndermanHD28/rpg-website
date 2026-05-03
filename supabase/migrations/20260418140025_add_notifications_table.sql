-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    content TEXT NOT NULL,
    is_important BOOLEAN DEFAULT false NOT NULL,
    master_id UUID REFERENCES auth.users(id),
    read_by UUID[] DEFAULT '{}' NOT NULL, -- Array of user IDs who have read the notification
    deleted_by UUID[] DEFAULT '{}' NOT NULL -- Array of user IDs who have deleted the notification (hidden for them)
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view notifications" 
ON public.notifications FOR SELECT 
USING (true);

CREATE POLICY "Anyone can update read_by and deleted_by" 
ON public.notifications FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can insert notifications" 
ON public.notifications FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can delete notifications" 
ON public.notifications FOR DELETE 
USING (true);
