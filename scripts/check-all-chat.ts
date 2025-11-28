/**
 * Check ALL Chat Messages
 * Shows all chat messages in the database (all users)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ecdrxtbclxfpkknasmrw.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

async function checkAllChatMessages(): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('\n🔍 Checking ALL Chat Messages');
  console.log('================================\n');

  const { data, error, count } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Total messages in database: ${count || 0}\n`);

  if (data && data.length > 0) {
    console.log('Recent messages (last 20):');
    console.log('─────────────────────────────────────\n');

    data.forEach((msg, i) => {
      console.log(`${i + 1}. User: ${msg.user_id}`);
      console.log(`   Type: ${msg.chatbot_type}`);
      console.log(`   Role: ${msg.role}`);
      console.log(`   Created: ${new Date(msg.created_at).toLocaleString()}`);
      console.log(`   Content: ${msg.content.substring(0, 80)}...`);
      console.log('');
    });

    // Group by user
    const byUser = data.reduce((acc, msg) => {
      acc[msg.user_id] = (acc[msg.user_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n📊 Messages by user:');
    for (const [userId, count] of Object.entries(byUser)) {
      console.log(`  ${userId}: ${count} messages`);
    }

  } else {
    console.log('✅ No chat messages in database');
  }
}

checkAllChatMessages().catch(console.error);
