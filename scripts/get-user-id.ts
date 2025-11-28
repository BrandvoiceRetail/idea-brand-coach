/**
 * Get User ID from Email
 *
 * Usage:
 *   npx tsx scripts/get-user-id.ts <email>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ecdrxtbclxfpkknasmrw.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

async function getUserId(email: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log(`\n🔍 Looking up user: ${email}\n`);

  // Try to get from profiles table which should have user info
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', email);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ User not found');
    return;
  }

  if (data.length > 1) {
    console.log(`⚠️  Found ${data.length} users with this email:`);
    data.forEach((user, idx) => {
      console.log(`\n${idx + 1}. ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.full_name || 'N/A'}`);
    });
    console.log('\n📋 To clear a user\'s data, run:');
    console.log(`   npx tsx scripts/clear-user-data.ts <user_id>\n`);
    return;
  }

  const user = data[0];
  console.log('✅ User found:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.full_name || 'N/A'}`);
  console.log('\n📋 To clear this user\'s data, run:');
  console.log(`   npx tsx scripts/clear-user-data.ts ${user.id}\n`);
}

const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/get-user-id.ts <email>');
  process.exit(1);
}

getUserId(email).catch(console.error);
