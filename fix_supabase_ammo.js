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

async function addAmmunitionColumns() {
  console.log('--- Attempting to add ammunition columns ---');
  
  // Characters
  console.log('Adding ammunition to characters...');
  const { error: charError } = await supabase.rpc('exec_sql', { 
    sql_query: "ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS ammunition JSONB DEFAULT '{}'::jsonb;" 
  });
  if (charError) console.error('Characters error:', charError.message);
  else console.log('Characters success!');

  // NPCs
  console.log('Adding ammunition to npcs...');
  const { error: npcError } = await supabase.rpc('exec_sql', { 
    sql_query: "ALTER TABLE public.npcs ADD COLUMN IF NOT EXISTS ammunition JSONB DEFAULT '{}'::jsonb;" 
  });
  if (npcError) console.error('NPCs error:', npcError.message);
  else console.log('NPCs success!');

  // Change Requests
  console.log('Adding ammunition support to change_requests...');
  // Note: change_requests stores full old_data/new_data objects which are already JSONB, 
  // so we don't necessarily need a new column if the entire character object is stored there.
  // However, it's good practice to ensure the baseline tables are updated.
}

addAmmunitionColumns();
