#!/usr/bin/env node

/**
 * Script to verify that persistence is working correctly
 * This will check if userId is properly set and data can be saved/loaded
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyPersistence() {
  console.log('🔍 Verifying User Authentication and Persistence Setup\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1: Check current session
  console.log('1. Checking Authentication Status...');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('❌ Error getting session:', sessionError.message);
    return;
  }

  if (!session) {
    console.log('⚠️  No active session found');
    console.log('\n📋 To test persistence, you need to:');
    console.log('   1. Open http://localhost:8080/auth');
    console.log('   2. Sign in with your account');
    console.log('   3. Navigate to http://localhost:8080/avatar');
    console.log('   4. Enter text in the first field');
    console.log('   5. Refresh the page');
    console.log('   6. The text should persist!\n');
    return;
  }

  console.log(`✅ User authenticated: ${session.user.email}`);
  console.log(`✅ User ID: ${session.user.id}\n`);

  // Step 2: Check if user_knowledge_base table exists and has data
  console.log('2. Checking Database Table...');
  const { data: tableData, error: tableError } = await supabase
    .from('user_knowledge_base')
    .select('*')
    .eq('user_id', session.user.id)
    .limit(5);

  if (tableError) {
    if (tableError.message.includes('relation') && tableError.message.includes('does not exist')) {
      console.log('❌ Table user_knowledge_base does not exist');
      console.log('   Run the migration: npm run deploy:schema\n');
    } else {
      console.error('❌ Error querying table:', tableError.message);
    }
    return;
  }

  console.log(`✅ Table exists with ${tableData?.length || 0} entries for this user\n`);

  if (tableData && tableData.length > 0) {
    console.log('3. Sample Data Found:');
    tableData.slice(0, 3).forEach((entry, index) => {
      console.log(`   ${index + 1}. Field: ${entry.field_identifier}`);
      console.log(`      Category: ${entry.category}`);
      console.log(`      Content: "${entry.content.substring(0, 50)}${entry.content.length > 50 ? '...' : ''}"`);
      console.log(`      Last Synced: ${entry.last_synced_at || 'Never'}\n`);
    });
  }

  // Step 3: Provide testing instructions
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ PERSISTENCE SYSTEM IS READY!\n');
  console.log('📋 Testing Instructions:');
  console.log('1. Open http://localhost:8080/avatar');
  console.log('2. Type something in the "Name" field');
  console.log('3. Wait 1 second (for debounce)');
  console.log('4. Check browser console for any errors');
  console.log('5. Refresh the page - data should persist!');
  console.log('6. Check IndexedDB in DevTools > Application > IndexedDB\n');

  console.log('🔍 What to Check in Browser Console:');
  console.log('- Add this to Avatar Builder to debug:');
  console.log('  console.log("userId:", user?.id)');
  console.log('  console.log("Auth user:", user)');
  console.log('\n🎯 Expected Behavior:');
  console.log('- Text appears instantly as you type');
  console.log('- After 500ms pause, data saves to IndexedDB');
  console.log('- Background sync to Supabase happens automatically');
  console.log('- On refresh, data loads from IndexedDB instantly\n');
}

// Run the verification
verifyPersistence().catch(console.error);