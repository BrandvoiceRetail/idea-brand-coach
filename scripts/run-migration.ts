/**
 * Run Migration Script
 * Executes a SQL migration against Supabase
 *
 * Usage:
 *   npx tsx scripts/run-migration.ts <migration-file>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ecdrxtbclxfpkknasmrw.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('\nYou can find the service role key in:');
  console.error('Supabase Dashboard → Settings → API → service_role key (secret)');
  process.exit(1);
}

async function runMigration(filePath: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log(`\n🔄 Running migration: ${filePath}\n`);

  try {
    // Read the SQL file
    const sql = readFileSync(filePath, 'utf8');

    // Execute each statement separately
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (!statement) continue;

      console.log(`Executing: ${statement.substring(0, 60)}...`);

      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        console.error('❌ Error:', error.message);
        throw error;
      }

      console.log('✅ Success');
    }

    console.log('\n✅ Migration completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: npx tsx scripts/run-migration.ts <migration-file>');
  process.exit(1);
}

runMigration(filePath).catch(console.error);
