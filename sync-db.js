import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function syncDB() {
  console.log('--- Database Sync Started ---');
  
  // SYNC ITEMS
  console.log('Fetching items from Supabase...');
  const { data: items, error: itemsError } = await supabase.from('items').select('*').order('name', { ascending: true });

  if (itemsError) {
    console.error('Error fetching items:', itemsError);
  } else {
    const itemsPath = path.join(__dirname, 'src', 'constants', 'items-db.json');
    fs.writeFileSync(itemsPath, JSON.stringify(items, null, 2), 'utf-8');
    console.log(`Successfully synced ${items.length} items to ${itemsPath}`);
  }

  // SYNC LOOT TABLES
  console.log('Fetching loot tables from Supabase...');
  const { data: lootTables, error: lootError } = await supabase.from('loot_tables').select('*').order('name', { ascending: true });

  if (lootError) {
    console.error('Error fetching loot tables:', lootError);
  } else {
    const lootPath = path.join(__dirname, 'src', 'constants', 'loot-db.json');
    fs.writeFileSync(lootPath, JSON.stringify(lootTables, null, 2), 'utf-8');
    console.log(`Successfully synced ${lootTables.length} loot tables to ${lootPath}`);
  }

  console.log('--- Database Sync Finished ---');
}

syncDB();
