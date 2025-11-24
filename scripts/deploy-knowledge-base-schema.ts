/**
 * Deploy user_knowledge_base schema to Supabase
 * Run with: npx tsx scripts/deploy-knowledge-base-schema.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  console.log('Note: You need the service key (not anon key) to run migrations.');
  console.log('You can find it in your Supabase dashboard under Settings > API > Service Role Key');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deploySchema() {
  try {
    console.log('📦 Deploying user_knowledge_base schema to Supabase...\n');

    // Read the migration file
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', '20241123_user_knowledge_base.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split into individual statements (Supabase might need this)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip pure comment lines
      if (statement.trim().startsWith('--')) continue;

      // Extract a description from the statement
      let description = 'SQL statement';
      if (statement.includes('CREATE TABLE')) {
        description = 'Creating user_knowledge_base table';
      } else if (statement.includes('CREATE INDEX')) {
        const indexName = statement.match(/CREATE INDEX (\w+)/)?.[1];
        description = `Creating index: ${indexName}`;
      } else if (statement.includes('CREATE POLICY')) {
        const policyName = statement.match(/CREATE POLICY "([^"]+)"/)?.[1];
        description = `Creating RLS policy: ${policyName}`;
      } else if (statement.includes('CREATE FUNCTION')) {
        const funcName = statement.match(/CREATE.*FUNCTION\s+(\S+)\(/)?.[1];
        description = `Creating function: ${funcName}`;
      } else if (statement.includes('CREATE TRIGGER')) {
        const triggerName = statement.match(/CREATE TRIGGER (\w+)/)?.[1];
        description = `Creating trigger: ${triggerName}`;
      } else if (statement.includes('GRANT')) {
        description = 'Granting permissions';
      } else if (statement.includes('ALTER TABLE')) {
        description = 'Enabling RLS';
      } else if (statement.includes('CREATE VIEW')) {
        description = 'Creating view: user_knowledge_current';
      } else if (statement.includes('COMMENT ON')) {
        description = 'Adding documentation comments';
      } else if (statement.includes('CREATE EXTENSION')) {
        description = 'Enabling pgvector extension';
      }

      console.log(`[${i + 1}/${statements.length}] ${description}...`);

      const { error } = await supabase.rpc('exec_sql', {
        query: statement
      }).single();

      if (error) {
        // Try direct execution as fallback
        const { error: directError } = await supabase.from('_sql').select(statement);

        if (directError) {
          console.error(`❌ Failed: ${directError.message}`);

          // If it's just that the table/index already exists, that's okay
          if (directError.message.includes('already exists')) {
            console.log('  ⚠️  Already exists, skipping...');
          } else {
            throw directError;
          }
        } else {
          console.log('  ✅ Success');
        }
      } else {
        console.log('  ✅ Success');
      }
    }

    console.log('\n✅ Schema deployment complete!');
    console.log('\nYou can now:');
    console.log('1. Test the Avatar Builder with offline functionality');
    console.log('2. Check Supabase dashboard to see the new user_knowledge_base table');
    console.log('3. Data will sync automatically when online\n');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    console.log('\n💡 Alternative: You can manually run the SQL in Supabase dashboard:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy the contents of supabase/migrations/20241123_user_knowledge_base.sql');
    console.log('4. Paste and run in the SQL editor\n');
    process.exit(1);
  }
}

// Run the deployment
deploySchema();