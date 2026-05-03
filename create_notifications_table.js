import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function createNotificationsTable() {
  console.log('--- Creating Notifications Table ---');
  
  const sql = `
    CREATE TABLE IF NOT EXISTS public.notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        content TEXT NOT NULL,
        is_important BOOLEAN DEFAULT false NOT NULL,
        master_id UUID REFERENCES auth.users(id),
        read_by UUID[] DEFAULT '{}' NOT NULL,
        deleted_by UUID[] DEFAULT '{}' NOT NULL
    );

    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Anyone can view notifications" ON public.notifications;
    CREATE POLICY "Anyone can view notifications" 
    ON public.notifications FOR SELECT 
    USING (true);

    DROP POLICY IF EXISTS "Anyone can update read_by and deleted_by" ON public.notifications;
    CREATE POLICY "Anyone can update read_by and deleted_by" 
    ON public.notifications FOR UPDATE 
    USING (true)
    WITH CHECK (true);

    DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
    CREATE POLICY "Anyone can insert notifications" 
    ON public.notifications FOR INSERT 
    WITH CHECK (true);

    DROP POLICY IF EXISTS "Anyone can delete notifications" ON public.notifications;
    CREATE POLICY "Anyone can delete notifications" 
    ON public.notifications FOR DELETE 
    USING (true);
  `;

    const { error } = await supabase.from('notifications').select('id').limit(1);
    if (error && error.code === '42P01') {
        // Table doesn't exist, try applying via another method or just inform
        console.log('Table does not exist. Please run the following SQL in your Supabase SQL Editor:');
        console.log(sql);
    } else if (error) {
        console.error('Error checking table:', error);
    } else {
        console.log('Notifications table already exists or was created successfully!');
    }
}

createNotificationsTable();
