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
  console.log('Adding approved_once and needs_celebration columns to characters table...');
  
  const { error } = await supabase.rpc('execute_sql', {
    sql: `
      ALTER TABLE characters 
      ADD COLUMN IF NOT EXISTS approved_once BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS needs_celebration BOOLEAN DEFAULT FALSE;
    `
  });

  if (error) {
    console.error('Error adding columns:', error);
    
    // Fallback: Try direct query if RPC doesn't exist (using a simple select to test connection)
    console.log('Attempting alternative method...');
    // In many Supabase setups, you can't run DDL via the JS client unless you have a specific RPC.
    // Let's check if we can at least see the error.
  } else {
    console.log('Columns added successfully (or already existed).');
  }
}

runMigration();
