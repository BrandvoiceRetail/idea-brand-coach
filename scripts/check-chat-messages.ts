/**
 * Check Chat Messages
 * Verify chat messages in database for a user
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ecdrxtbclxfpkknasmrw.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

async function checkChatMessages(userId: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('\n🔍 Checking Chat Messages');
  console.log('================================\n');
  console.log(`User ID: ${userId}\n`);

  const { data, error, count } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Total messages: ${count || 0}\n`);

  if (data && data.length > 0) {
    console.log('Messages by chatbot type:');
    const byType = data.reduce((acc, msg) => {
      acc[msg.chatbot_type] = (acc[msg.chatbot_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [type, count] of Object.entries(byType)) {
      console.log(`  ${type}: ${count} messages`);
    }

    console.log('\n📋 Recent messages:');
    data.slice(-5).forEach((msg, i) => {
      console.log(`\n${i + 1}. [${msg.chatbot_type}] ${msg.role}`);
      console.log(`   Created: ${new Date(msg.created_at).toLocaleString()}`);
      console.log(`   Content: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
    });
  } else {
    console.log('✅ No chat messages found (database is clean)');
  }
}

const userId = process.argv[2];

if (!userId) {
  console.error('Usage: npx tsx scripts/check-chat-messages.ts <user_id>');
  process.exit(1);
}

checkChatMessages(userId).catch(console.error);
