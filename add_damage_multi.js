import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function applyMigration() {
  console.log('--- Applying damage_multi Column Migration ---');
  
  const sql = `
    ALTER TABLE public.items 
    ADD COLUMN IF NOT EXISTS damage_multi FLOAT DEFAULT 1.0;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('Error applying migration:', error);
  } else {
    console.log('Successfully applied migration!');
  }
}

applyMigration();