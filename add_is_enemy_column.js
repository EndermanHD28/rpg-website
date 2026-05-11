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
  console.log('Adding is_enemy column to characters table...');
  
  const { error } = await supabase.rpc('execute_sql', {
    sql: `
      ALTER TABLE characters 
      ADD COLUMN IF NOT EXISTS is_enemy BOOLEAN DEFAULT FALSE;
    `
  });

  if (error) {
    console.error('Error adding column:', error);
  } else {
    console.log('Column is_enemy added successfully to characters.');
  }
}

runMigration();
