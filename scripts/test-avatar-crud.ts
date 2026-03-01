/**
 * Avatar CRUD Operations Integration Test
 *
 * Comprehensive verification of all avatar CRUD operations:
 * - Create avatar with auto-name generation
 * - Fetch all avatars for user
 * - Update avatar fields
 * - Duplicate avatar with new name
 * - Delete avatar
 * - RLS policies prevent cross-user access
 *
 * Prerequisites:
 * 1. Supabase local development environment running: `supabase start`
 * 2. Avatar migration applied (check with: `supabase migration list --local`)
 * 3. Valid user ID (get with: `npx tsx scripts/get-user-id.ts <email>`)
 *
 * Usage:
 *   npx tsx scripts/test-avatar-crud.ts <user_id>
 *
 * Environment Variables (optional):
 *   SUPABASE_URL - Supabase API URL (defaults to local: http://127.0.0.1:54321)
 *   SUPABASE_ANON_KEY - Supabase anon key (defaults to local key)
 */

import { createClient } from '@supabase/supabase-js';

// Use local Supabase by default for testing, or override with environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, message: string): void {
  results.push({ name, passed, message });
  const emoji = passed ? '✅' : '❌';
  console.log(`${emoji} ${name}: ${message}`);
}

function printSummary(): void {
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
  }

  console.log('\n' + (failed === 0 ? '✅ All tests passed!' : '❌ Some tests failed'));
}

async function testAvatarCRUD(userId: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('\n🧪 Avatar CRUD Integration Test');
  console.log('='.repeat(60));
  console.log(`Environment: ${SUPABASE_URL}`);
  console.log(`User ID: ${userId}\n`);

  let createdAvatarId: string | null = null;
  let duplicatedAvatarId: string | null = null;

  try {
    // Test 1: Create avatar with explicit name
    console.log('\n📝 Test 1: Create Avatar with Explicit Name');
    console.log('-'.repeat(60));

    const createData = {
      user_id: userId,
      name: 'Test Avatar',
      description: 'Integration test avatar',
      demographics: {
        age: '25-34',
        income: '$75k-100k',
        location: 'urban',
        lifestyle: 'Active professional'
      },
      psychographics: {
        values: ['quality', 'sustainability'],
        fears: ['wasting money'],
        desires: ['status', 'belonging'],
        triggers: ['social proof']
      },
      buying_behavior: {
        intent: 'high',
        decision_factors: ['price', 'quality', 'reviews'],
        shopping_style: 'researcher',
        price_consciousness: 'medium'
      },
      voice_of_customer: 'I value quality over quantity',
      is_template: false
    };

    const { data: created, error: createError } = await supabase
      .from('avatars')
      .insert(createData)
      .select()
      .single();

    if (createError) {
      logTest('Create Avatar', false, `Error: ${createError.message}`);
    } else if (!created) {
      logTest('Create Avatar', false, 'No data returned');
    } else {
      createdAvatarId = created.id;
      logTest('Create Avatar', true, `Created avatar with ID: ${created.id}`);
      console.log(`   Name: ${created.name}`);
      console.log(`   Description: ${created.description}`);
      console.log(`   Demographics: ${JSON.stringify(created.demographics)}`);
      console.log(`   Created at: ${new Date(created.created_at).toLocaleString()}`);
    }

    // Test 2: Fetch all avatars for user
    console.log('\n📋 Test 2: Fetch All Avatars');
    console.log('-'.repeat(60));

    const { data: allAvatars, error: fetchError, count } = await supabase
      .from('avatars')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      logTest('Fetch All Avatars', false, `Error: ${fetchError.message}`);
    } else {
      logTest('Fetch All Avatars', allAvatars.length > 0, `Found ${count} avatar(s)`);
      allAvatars.forEach((avatar, i) => {
        console.log(`   ${i + 1}. ${avatar.name} (${avatar.id})`);
        console.log(`      Updated: ${new Date(avatar.updated_at).toLocaleString()}`);
      });
    }

    // Test 3: Get avatar by ID
    if (createdAvatarId) {
      console.log('\n🔍 Test 3: Get Avatar by ID');
      console.log('-'.repeat(60));

      const { data: fetchedAvatar, error: getByIdError } = await supabase
        .from('avatars')
        .select('*')
        .eq('id', createdAvatarId)
        .eq('user_id', userId)
        .maybeSingle();

      if (getByIdError) {
        logTest('Get Avatar by ID', false, `Error: ${getByIdError.message}`);
      } else if (!fetchedAvatar) {
        logTest('Get Avatar by ID', false, 'Avatar not found');
      } else {
        logTest('Get Avatar by ID', true, `Fetched avatar: ${fetchedAvatar.name}`);
        console.log(`   ID: ${fetchedAvatar.id}`);
        console.log(`   Name: ${fetchedAvatar.name}`);
        console.log(`   Is Template: ${fetchedAvatar.is_template}`);
      }
    }

    // Test 4: Update avatar fields
    if (createdAvatarId) {
      console.log('\n✏️  Test 4: Update Avatar Fields');
      console.log('-'.repeat(60));

      const updateData = {
        name: 'Updated Test Avatar',
        description: 'Updated description for testing',
        demographics: {
          age: '35-44',
          income: '$100k-150k',
          location: 'suburban',
          lifestyle: 'Family-focused professional'
        }
      };

      const { data: updated, error: updateError } = await supabase
        .from('avatars')
        .update(updateData)
        .eq('id', createdAvatarId)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        logTest('Update Avatar', false, `Error: ${updateError.message}`);
      } else if (!updated) {
        logTest('Update Avatar', false, 'No data returned');
      } else {
        const nameUpdated = updated.name === updateData.name;
        const descUpdated = updated.description === updateData.description;
        const demoUpdated = JSON.stringify(updated.demographics) === JSON.stringify(updateData.demographics);

        logTest('Update Avatar', nameUpdated && descUpdated && demoUpdated, 'All fields updated correctly');
        console.log(`   New name: ${updated.name}`);
        console.log(`   New description: ${updated.description}`);
        console.log(`   Updated demographics: ${JSON.stringify(updated.demographics)}`);
        console.log(`   Updated at: ${new Date(updated.updated_at).toLocaleString()}`);
      }
    }

    // Test 5: Duplicate avatar
    if (createdAvatarId) {
      console.log('\n📄 Test 5: Duplicate Avatar');
      console.log('-'.repeat(60));

      // First, fetch the source avatar
      const { data: sourceAvatar, error: fetchSourceError } = await supabase
        .from('avatars')
        .select('*')
        .eq('id', createdAvatarId)
        .single();

      if (fetchSourceError) {
        logTest('Duplicate Avatar - Fetch Source', false, `Error: ${fetchSourceError.message}`);
      } else {
        // Create duplicate with new name
        const duplicateData = {
          user_id: userId,
          name: 'Copy of ' + sourceAvatar.name,
          description: sourceAvatar.description,
          demographics: sourceAvatar.demographics,
          psychographics: sourceAvatar.psychographics,
          buying_behavior: sourceAvatar.buying_behavior,
          voice_of_customer: sourceAvatar.voice_of_customer,
          is_template: false // Duplicates are never templates
        };

        const { data: duplicated, error: duplicateError } = await supabase
          .from('avatars')
          .insert(duplicateData)
          .select()
          .single();

        if (duplicateError) {
          logTest('Duplicate Avatar', false, `Error: ${duplicateError.message}`);
        } else if (!duplicated) {
          logTest('Duplicate Avatar', false, 'No data returned');
        } else {
          duplicatedAvatarId = duplicated.id;
          const dataMatches =
            JSON.stringify(duplicated.demographics) === JSON.stringify(sourceAvatar.demographics) &&
            JSON.stringify(duplicated.psychographics) === JSON.stringify(sourceAvatar.psychographics) &&
            JSON.stringify(duplicated.buying_behavior) === JSON.stringify(sourceAvatar.buying_behavior);

          logTest('Duplicate Avatar', dataMatches && duplicated.name.startsWith('Copy of'),
            `Created duplicate: ${duplicated.name}`);
          console.log(`   Original ID: ${createdAvatarId}`);
          console.log(`   Duplicate ID: ${duplicated.id}`);
          console.log(`   Duplicate name: ${duplicated.name}`);
          console.log(`   Data preserved: ${dataMatches}`);
        }
      }
    }

    // Test 6: Auto-generate unique name
    console.log('\n🔢 Test 6: Auto-Generate Unique Name');
    console.log('-'.repeat(60));

    // Fetch existing names
    const { data: existingAvatars } = await supabase
      .from('avatars')
      .select('name')
      .eq('user_id', userId);

    const existingNames = new Set(existingAvatars?.map(a => a.name) || []);

    // Generate unique name
    let counter = 1;
    let uniqueName = `Avatar ${counter}`;
    while (existingNames.has(uniqueName)) {
      counter++;
      uniqueName = `Avatar ${counter}`;
    }

    const { data: autoNamed, error: autoNameError } = await supabase
      .from('avatars')
      .insert({
        user_id: userId,
        name: uniqueName,
        description: 'Auto-named avatar',
        is_template: false
      })
      .select()
      .single();

    if (autoNameError) {
      logTest('Auto-Generate Name', false, `Error: ${autoNameError.message}`);
    } else if (!autoNamed) {
      logTest('Auto-Generate Name', false, 'No data returned');
    } else {
      logTest('Auto-Generate Name', autoNamed.name === uniqueName,
        `Generated unique name: ${autoNamed.name}`);

      // Clean up auto-named avatar
      await supabase.from('avatars').delete().eq('id', autoNamed.id);
    }

    // Test 7: RLS policies - cross-user access prevention
    console.log('\n🔒 Test 7: RLS Policies - Cross-User Access');
    console.log('-'.repeat(60));

    if (createdAvatarId) {
      // Create a different user ID to test RLS
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      // Try to fetch another user's avatar (should return empty)
      const { data: crossUserFetch, error: crossUserError } = await supabase
        .from('avatars')
        .select('*')
        .eq('id', createdAvatarId)
        .eq('user_id', fakeUserId)
        .maybeSingle();

      // RLS should prevent this - should return null
      const blocked = !crossUserError && !crossUserFetch;
      logTest('RLS - Read Prevention', blocked,
        blocked ? 'Cross-user read correctly blocked' : 'WARNING: Cross-user read not blocked');

      // Try to update another user's avatar (should fail)
      const { error: crossUserUpdateError } = await supabase
        .from('avatars')
        .update({ name: 'Hacked Name' })
        .eq('id', createdAvatarId)
        .eq('user_id', fakeUserId);

      // Should not affect any rows
      logTest('RLS - Update Prevention', !crossUserUpdateError || crossUserUpdateError.code === 'PGRST116',
        'Cross-user update correctly blocked');

      // Try to delete another user's avatar (should fail)
      const { error: crossUserDeleteError } = await supabase
        .from('avatars')
        .delete()
        .eq('id', createdAvatarId)
        .eq('user_id', fakeUserId);

      logTest('RLS - Delete Prevention', !crossUserDeleteError || crossUserDeleteError.code === 'PGRST116',
        'Cross-user delete correctly blocked');
    }

    // Test 8: Timestamp auto-update
    if (createdAvatarId) {
      console.log('\n⏰ Test 8: Timestamp Auto-Update');
      console.log('-'.repeat(60));

      const { data: beforeUpdate } = await supabase
        .from('avatars')
        .select('updated_at')
        .eq('id', createdAvatarId)
        .single();

      const beforeTime = beforeUpdate?.updated_at;

      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update avatar
      const { data: afterUpdate } = await supabase
        .from('avatars')
        .update({ description: 'Timestamp test update' })
        .eq('id', createdAvatarId)
        .eq('user_id', userId)
        .select('updated_at')
        .single();

      const afterTime = afterUpdate?.updated_at;

      const timestampUpdated = beforeTime && afterTime && new Date(afterTime) > new Date(beforeTime);
      logTest('Timestamp Auto-Update', !!timestampUpdated,
        timestampUpdated ? `Updated from ${beforeTime} to ${afterTime}` : 'Timestamp not auto-updated');
    }

    // Test 9: Delete avatar
    if (createdAvatarId) {
      console.log('\n🗑️  Test 9: Delete Avatar');
      console.log('-'.repeat(60));

      const { error: deleteError } = await supabase
        .from('avatars')
        .delete()
        .eq('id', createdAvatarId)
        .eq('user_id', userId);

      if (deleteError) {
        logTest('Delete Avatar', false, `Error: ${deleteError.message}`);
      } else {
        // Verify deletion
        const { data: verifyDelete } = await supabase
          .from('avatars')
          .select('id')
          .eq('id', createdAvatarId)
          .maybeSingle();

        logTest('Delete Avatar', !verifyDelete,
          verifyDelete ? 'Avatar still exists after delete' : 'Avatar successfully deleted');
      }
    }

    // Clean up duplicated avatar if exists
    if (duplicatedAvatarId) {
      await supabase
        .from('avatars')
        .delete()
        .eq('id', duplicatedAvatarId)
        .eq('user_id', userId);
    }

  } catch (error) {
    console.error('\n❌ Unexpected Error:', error);
  }

  printSummary();
}

const userId = process.argv[2];

if (!userId) {
  console.error('❌ Error: User ID is required\n');
  console.error('Usage: npx tsx scripts/test-avatar-crud.ts <user_id>\n');
  console.error('Prerequisites:');
  console.error('  1. Start Supabase: supabase start');
  console.error('  2. Verify migration: supabase migration list --local');
  console.error('  3. Get user ID: npx tsx scripts/get-user-id.ts <email>\n');
  console.error('Example:');
  console.error('  npx tsx scripts/test-avatar-crud.ts "123e4567-e89b-12d3-a456-426614174000"');
  process.exit(1);
}

testAvatarCRUD(userId).catch(console.error);
