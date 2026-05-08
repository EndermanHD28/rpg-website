import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Adding maintenance columns to global table...');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql_query: `
      ALTER TABLE public.global 
      ADD COLUMN IF NOT EXISTS is_maintenance_active BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS allowed_discord_usernames TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS blocked_tabs TEXT[] DEFAULT '{}';
    `
  });

  if (error) {
    console.error('Error adding columns:', error);
  } else {
    console.log('Columns added successfully (or already existed).');
  }
}

runMigration();
