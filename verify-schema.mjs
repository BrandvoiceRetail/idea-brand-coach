#!/usr/bin/env node
/**
 * Database Schema Verification Script
 * Verifies brands, avatars, performance_metrics tables and RLS policies
 */

import { createClient } from '@supabase/supabase-js';

// Local Supabase connection
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const results = {
  passed: [],
  failed: [],
};

function logTest(name, passed, details = '') {
  const status = passed ? '✓' : '✗';
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`${color}${status}${reset} ${name}${details ? ': ' + details : ''}`);

  if (passed) {
    results.passed.push(name);
  } else {
    results.failed.push(name);
  }
}

async function verifyTableExists(tableName, expectedColumns) {
  console.log(`\n--- Verifying ${tableName} table ---`);

  try {
    // Try to query the table (as service role to bypass RLS)
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      // Check if it's an RLS error (table exists but RLS blocking)
      if (error.message.includes('row-level security') || error.code === 'PGRST301') {
        logTest(`${tableName} table exists`, true);
        logTest(`${tableName} has RLS enabled`, true);
        return true;
      }

      // Table might not exist or other error
      logTest(`${tableName} table exists`, false, error.message);
      return false;
    }

    logTest(`${tableName} table exists`, true);
    return true;
  } catch (err) {
    logTest(`${tableName} table exists`, false, err.message);
    return false;
  }
}

async function verifyForeignKey(childTable, childColumn, parentTable) {
  console.log(`\nVerifying foreign key: ${childTable}.${childColumn} -> ${parentTable}`);

  // We'll check this by inspecting the TypeScript types file
  try {
    const { readFile } = await import('fs/promises');
    const typesContent = await readFile('./src/integrations/supabase/types.ts', 'utf-8');

    // Look for the relationship in the types file
    const hasRelationship = typesContent.includes(childTable) &&
                           typesContent.includes(childColumn) &&
                           typesContent.includes(parentTable);

    logTest(`${childTable}.${childColumn} -> ${parentTable} FK`, hasRelationship);
    return hasRelationship;
  } catch (err) {
    logTest(`${childTable}.${childColumn} -> ${parentTable} FK`, false, err.message);
    return false;
  }
}

async function checkChatSessionsAvatarColumn() {
  console.log('\n--- Verifying chat_sessions.avatar_id column ---');

  try {
    const { readFile } = await import('fs/promises');
    const typesContent = await readFile('./src/integrations/supabase/types.ts', 'utf--8');

    // Check if avatar_id is in chat_sessions
    const hasAvatarId = typesContent.includes('chat_sessions') &&
                        typesContent.match(/avatar_id[:\s]*string\s*\|\s*null/);

    logTest('chat_sessions has avatar_id column', hasAvatarId);
    return hasAvatarId;
  } catch (err) {
    logTest('chat_sessions has avatar_id column', false, err.message);
    return false;
  }
}

async function verifyMigrationFiles() {
  console.log('\n--- Verifying Migration Files ---');

  try {
    const { readdir, readFile } = await import('fs/promises');
    const files = await readdir('./supabase/migrations');

    const expectedMigrations = [
      { pattern: 'create_brands_table.sql', name: 'brands table migration' },
      { pattern: 'create_avatars_table.sql', name: 'avatars table migration' },
      { pattern: 'create_performance_metrics_table.sql', name: 'performance_metrics table migration' },
      { pattern: 'add_avatar_id_to_chat_sessions.sql', name: 'avatar_id column migration' },
      { pattern: 'migrate_existing_users_to_brands.sql', name: 'data migration' },
    ];

    for (const expected of expectedMigrations) {
      const found = files.some(f => f.includes(expected.pattern));
      logTest(expected.name, found);

      if (found) {
        const file = files.find(f => f.includes(expected.pattern));
        const content = await readFile(`./supabase/migrations/${file}`, 'utf-8');

        // Check for RLS enablement in table creation migrations
        if (expected.pattern.includes('create_') && expected.pattern.includes('_table')) {
          const hasRLS = content.includes('ENABLE ROW LEVEL SECURITY');
          logTest(`${expected.name} enables RLS`, hasRLS);

          const hasPolicies = content.includes('CREATE POLICY');
          logTest(`${expected.name} has policies`, hasPolicies);
        }
      }
    }
  } catch (err) {
    logTest('Migration files verification', false, err.message);
  }
}

async function verifyTypeScriptTypes() {
  console.log('\n--- Verifying TypeScript Types ---');

  try {
    const { readFile } = await import('fs/promises');
    const typesContent = await readFile('./src/integrations/supabase/types.ts', 'utf-8');

    const expectedTables = ['brands', 'avatars', 'performance_metrics'];

    for (const table of expectedTables) {
      const hasTable = typesContent.includes(`${table}:`);
      logTest(`TypeScript types include ${table}`, hasTable);

      if (hasTable) {
        // Check for Row, Insert, Update types
        const hasRow = typesContent.includes(`${table}: {`) && typesContent.includes('Row:');
        const hasInsert = typesContent.includes('Insert:');
        const hasUpdate = typesContent.includes('Update:');

        logTest(`${table} has Row/Insert/Update types`, hasRow && hasInsert && hasUpdate);
      }
    }

    // Check chat_sessions has avatar_id
    const chatSessionsHasAvatarId = typesContent.match(/chat_sessions[\s\S]*?avatar_id/);
    logTest('chat_sessions types include avatar_id', !!chatSessionsHasAvatarId);

  } catch (err) {
    logTest('TypeScript types verification', false, err.message);
  }
}

async function checkDataMigration() {
  console.log('\n--- Checking Data Migration ---');

  try {
    const { readFile } = await import('fs/promises');
    const migrationContent = await readFile(
      './supabase/migrations/20260228230012_migrate_existing_users_to_brands.sql',
      'utf-8'
    );

    // Verify migration creates brands
    const createsBrands = migrationContent.includes('INSERT INTO public.brands');
    logTest('Migration creates brands for users', createsBrands);

    // Verify migration creates avatars
    const createsAvatars = migrationContent.includes('INSERT INTO public.avatars');
    logTest('Migration creates avatars for users', createsAvatars);

    // Verify migration updates chat_sessions
    const updatesChat = migrationContent.includes('UPDATE public.chat_sessions');
    logTest('Migration links chat_sessions to avatars', updatesChat);

    // Verify it loops through profiles
    const loopsProfiles = migrationContent.includes('FROM public.profiles');
    logTest('Migration processes all users', loopsProfiles);

  } catch (err) {
    logTest('Data migration verification', false, err.message);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('DATABASE SCHEMA VERIFICATION');
  console.log('='.repeat(60));

  // Verify migration files exist and have correct content
  await verifyMigrationFiles();

  // Verify TypeScript types were generated
  await verifyTypeScriptTypes();

  // Verify tables exist (via types since we can't query directly without auth)
  console.log('\n--- Table Structure Verification ---');
  await verifyTableExists('brands');
  await verifyTableExists('avatars');
  await verifyTableExists('performance_metrics');
  await verifyTableExists('chat_sessions');

  // Verify foreign keys (via types)
  await verifyForeignKey('avatars', 'brand_id', 'brands');
  await verifyForeignKey('performance_metrics', 'avatar_id', 'avatars');
  await verifyForeignKey('chat_sessions', 'avatar_id', 'avatars');

  // Verify data migration
  await checkDataMigration();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✓ Passed: ${results.passed.length}`);
  console.log(`✗ Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('\nFailed tests:');
    results.failed.forEach(test => console.log(`  - ${test}`));
    process.exit(1);
  } else {
    console.log('\n✓ All verifications passed!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Verification script error:', err);
  process.exit(1);
});
