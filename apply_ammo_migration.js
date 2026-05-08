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

async function applyMigration() {
  console.log('--- Applying Ammunition Columns Migration ---');
  
  const sql = `
    ALTER TABLE public.characters 
    ADD COLUMN IF NOT EXISTS ammunition JSONB DEFAULT '{}'::jsonb;
    
    ALTER TABLE public.npcs 
    ADD COLUMN IF NOT EXISTS ammunition JSONB DEFAULT '{}'::jsonb;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    if (error.message.includes('function "exec_sql" does not exist')) {
        console.log('RPC exec_sql not found. This script requires a way to execute arbitrary SQL.');
        console.log('Please run the following SQL in your Supabase SQL Editor:');
        console.log(sql);
    } else {
        console.error('Error applying migration:', error);
    }
  } else {
    console.log('Successfully applied migration!');
  }
}

applyMigration();
