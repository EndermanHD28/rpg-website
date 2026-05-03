import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function applyRLS() {
  console.log('--- Applying RLS Policies from apply_rls_policies.sql ---');
  
  const sql = fs.readFileSync('apply_rls_policies.sql', 'utf8');

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    if (error.message.includes('function "exec_sql" does not exist')) {
        console.log('RPC exec_sql not found. This script requires a way to execute arbitrary SQL.');
        console.log('Please run the SQL in apply_rls_policies.sql manually in your Supabase SQL Editor.');
    } else {
        console.error('Error applying RLS policies:', error);
    }
  } else {
    console.log('Successfully applied RLS policies!');
  }
}

applyRLS();
