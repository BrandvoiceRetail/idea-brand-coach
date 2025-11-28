/**
 * Clear User Data Script
 * Clears all user knowledge base entries and chat history for testing
 *
 * Usage:
 *   npx tsx scripts/clear-user-data.ts <user_id>
 *   npx tsx scripts/clear-user-data.ts <user_id> --keep-chat
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ecdrxtbclxfpkknasmrw.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

async function clearUserData(userId: string, keepChat: boolean = false): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('\n🗑️  Clearing User Data');
  console.log('================================\n');
  console.log(`User ID: ${userId}`);
  console.log(`Keep Chat History: ${keepChat ? 'Yes' : 'No'}\n`);

  try {
    // Clear knowledge base
    console.log('🗑️  Clearing user_knowledge_base...');
    const { error: kbError, count: kbCount } = await supabase
      .from('user_knowledge_base')
      .delete({ count: 'exact' })
      .eq('user_id', userId);

    if (kbError) {
      console.error('❌ Error clearing knowledge base:', kbError);
    } else {
      console.log(`✅ Deleted ${kbCount || 0} knowledge base entries`);
    }

    // Clear chat history (unless --keep-chat flag)
    if (!keepChat) {
      console.log('\n🗑️  Clearing chat_messages...');
      const { error: chatError, count: chatCount } = await supabase
        .from('chat_messages')
        .delete({ count: 'exact' })
        .eq('user_id', userId);

      if (chatError) {
        console.error('❌ Error clearing chat messages:', chatError);
      } else {
        console.log(`✅ Deleted ${chatCount || 0} chat messages`);
      }
    }

    console.log('\n✅ Data cleared successfully!\n');
    console.log('📋 Next steps:');
    console.log('1. Clear browser IndexedDB:');
    console.log('   - Open DevTools → Application → IndexedDB');
    console.log('   - Delete "idea-brand-coach" database');
    console.log('   - Refresh page');
    console.log('2. Start entering test data');
    console.log('3. Run: npx tsx scripts/check-field-sync-status.ts ' + userId);
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);
const userId = args[0];
const keepChat = args.includes('--keep-chat');

if (!userId) {
  console.error('Usage: npx tsx scripts/clear-user-data.ts <user_id> [--keep-chat]');
  console.error('\nExamples:');
  console.error('  npx tsx scripts/clear-user-data.ts a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  console.error('  npx tsx scripts/clear-user-data.ts a1b2c3d4-e5f6-7890-abcd-ef1234567890 --keep-chat');
  console.error('\nTo get your user ID:');
  console.error('  - Supabase Dashboard → Authentication → Users');
  console.error('  - Or run this in browser console: localStorage.getItem("supabase.auth.token")');
  process.exit(1);
}

clearUserData(userId, keepChat).catch(console.error);
