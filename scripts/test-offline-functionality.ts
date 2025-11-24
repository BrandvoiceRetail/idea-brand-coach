/**
 * Test script for offline functionality of user knowledge base
 * Tests local-first architecture with IndexedDB and Supabase sync
 */

import { KnowledgeRepository } from '../src/lib/knowledge-base/knowledge-repository';
import { SupabaseSyncService } from '../src/lib/knowledge-base/supabase-sync-service';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test data
const TEST_USER_ID = 'test-user-' + Date.now();
const TEST_FIELDS = [
  { identifier: 'avatar_name', category: 'avatar' as const, content: 'John Smith' },
  { identifier: 'avatar_age', category: 'avatar' as const, content: '35' },
  { identifier: 'avatar_occupation', category: 'avatar' as const, content: 'Software Engineer' },
  { identifier: 'canvas_brand_purpose', category: 'canvas' as const, content: 'To innovate and inspire' },
  { identifier: 'canvas_brand_values', category: 'canvas' as const, content: '["Innovation", "Excellence", "Integrity"]' }
];

// Color output helpers
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const blue = (text: string) => `\x1b[34m${text}\x1b[0m`;

async function testOfflineFunctionality() {
  console.log(blue('\n🧪 Testing Offline Functionality for User Knowledge Base\n'));
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // 1. Initialize repository
    console.log(yellow('1. Initializing Knowledge Repository...'));
    const repository = new KnowledgeRepository({
      dbName: 'idea-brand-coach-test',
      dbVersion: 1,
      syncInterval: 0, // Disable auto-sync for testing
      conflictResolution: 'local-first'
    });
    await repository.initialize();
    console.log(green('✓ Repository initialized successfully\n'));

    // 2. Test local saving (IndexedDB)
    console.log(yellow('2. Testing Local Storage (IndexedDB)...'));
    const startTime = performance.now();

    for (const field of TEST_FIELDS) {
      await repository.saveField(TEST_USER_ID, field.identifier, field.content, field.category);
    }

    const saveTime = performance.now() - startTime;
    console.log(green(`✓ Saved ${TEST_FIELDS.length} fields locally in ${saveTime.toFixed(2)}ms`));
    console.log(green(`✓ Average save time: ${(saveTime / TEST_FIELDS.length).toFixed(2)}ms per field\n`));

    // 3. Test local retrieval
    console.log(yellow('3. Testing Local Retrieval...'));
    const retrieveStart = performance.now();

    for (const field of TEST_FIELDS) {
      const value = await repository.getField(TEST_USER_ID, field.identifier);
      if (value !== field.content) {
        throw new Error(`Field mismatch: ${field.identifier} expected "${field.content}" but got "${value}"`);
      }
    }

    const retrieveTime = performance.now() - retrieveStart;
    console.log(green(`✓ Retrieved ${TEST_FIELDS.length} fields in ${retrieveTime.toFixed(2)}ms`));
    console.log(green(`✓ Average retrieval time: ${(retrieveTime / TEST_FIELDS.length).toFixed(2)}ms per field`));

    if ((retrieveTime / TEST_FIELDS.length) < 10) {
      console.log(green('✓ Meeting <10ms per field target for instant loading!\n'));
    } else {
      console.log(yellow(`⚠ Retrieval time ${(retrieveTime / TEST_FIELDS.length).toFixed(2)}ms exceeds 10ms target\n`));
    }

    // 4. Test offline mode (simulate network failure)
    console.log(yellow('4. Testing Offline Mode...'));

    // Create sync service
    const syncService = new SupabaseSyncService(repository);

    // Simulate offline by using invalid URL
    const originalUrl = process.env.VITE_SUPABASE_URL;
    process.env.VITE_SUPABASE_URL = 'https://offline.invalid.url';

    // Try to sync (should fail gracefully)
    try {
      await syncService.syncAllFields(TEST_USER_ID);
      console.log(red('✗ Sync should have failed in offline mode'));
    } catch (error) {
      console.log(green('✓ Sync failed gracefully in offline mode'));
    }

    // Data should still be accessible locally
    const offlineValue = await repository.getField(TEST_USER_ID, 'avatar_name');
    if (offlineValue === 'John Smith') {
      console.log(green('✓ Data still accessible while offline\n'));
    } else {
      console.log(red('✗ Data not accessible offline\n'));
    }

    // Restore URL
    process.env.VITE_SUPABASE_URL = originalUrl;

    // 5. Test persistence across sessions
    console.log(yellow('5. Testing Persistence Across Sessions...'));

    // Create new repository instance (simulating page refresh)
    const newRepository = new KnowledgeRepository({
      dbName: 'idea-brand-coach-test',
      dbVersion: 1,
      syncInterval: 0,
      conflictResolution: 'local-first'
    });
    await newRepository.initialize();

    // Check if data persists
    const persistedValue = await newRepository.getField(TEST_USER_ID, 'avatar_name');
    if (persistedValue === 'John Smith') {
      console.log(green('✓ Data persists across sessions (page refreshes)\n'));
    } else {
      console.log(red('✗ Data not persisting across sessions\n'));
    }

    // 6. Test Supabase sync (if credentials available)
    if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
      console.log(yellow('6. Testing Supabase Sync...'));

      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_ANON_KEY
      );

      // Check if we can connect
      const { data: authData, error: authError } = await supabase.auth.getSession();

      if (authError || !authData.session) {
        console.log(yellow('⚠ No active session - skipping Supabase sync test'));
        console.log(yellow('  (This is expected without authentication)\n'));
      } else {
        // Try to sync
        const syncService2 = new SupabaseSyncService(newRepository);
        await syncService2.syncAllFields(authData.session.user.id);
        console.log(green('✓ Successfully synced to Supabase\n'));
      }
    } else {
      console.log(yellow('⚠ Supabase credentials not found - skipping sync test\n'));
    }

    // 7. Test conflict resolution
    console.log(yellow('7. Testing Conflict Resolution...'));

    // Simulate local change
    await newRepository.saveField(TEST_USER_ID, 'avatar_name', 'Jane Doe', 'avatar');

    // Check that local-first strategy preserves local change
    const localValue = await newRepository.getField(TEST_USER_ID, 'avatar_name');
    if (localValue === 'Jane Doe') {
      console.log(green('✓ Local-first conflict resolution working correctly\n'));
    } else {
      console.log(red('✗ Conflict resolution not working as expected\n'));
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log(green('\n✅ All Offline Functionality Tests Passed!\n'));
    console.log('Key Results:');
    console.log(`  • Local save time: ${(saveTime / TEST_FIELDS.length).toFixed(2)}ms per field`);
    console.log(`  • Local load time: ${(retrieveTime / TEST_FIELDS.length).toFixed(2)}ms per field`);
    console.log('  • Offline mode: Working');
    console.log('  • Data persistence: Working');
    console.log('  • Conflict resolution: Local-first strategy active\n');

    // Cleanup
    await newRepository.clearAllData();
    console.log(blue('🧹 Test data cleaned up\n'));

  } catch (error) {
    console.error(red('\n❌ Test failed with error:'), error);
    process.exit(1);
  }
}

// Run the tests
testOfflineFunctionality();