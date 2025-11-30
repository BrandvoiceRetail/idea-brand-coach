/**
 * Verification Script: Check Chat Message Deletion
 *
 * This script helps verify that chat messages are properly deleted from the database.
 * Run this before and after clearing a conversation to confirm deletion.
 *
 * Usage:
 *   npx tsx scripts/verify-chat-deletion.ts <user_id> [session_id]
 *
 * Examples:
 *   npx tsx scripts/verify-chat-deletion.ts d5868b7d-11aa-4c3b-b19b-28853d5d5923
 *   npx tsx scripts/verify-chat-deletion.ts d5868b7d-11aa-4c3b-b19b-28853d5d5923 abc123-session-id
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   VITE_SUPABASE_PUBLISHABLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyChatMessages(userId: string, sessionId?: string) {
  console.log('\n🔍 Verifying Chat Messages in Database\n');
  console.log('User ID:', userId);
  if (sessionId) {
    console.log('Session ID:', sessionId);
  }
  console.log('─'.repeat(60));

  // Get all sessions for user
  const { data: sessions, error: sessionsError } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (sessionsError) {
    console.error('❌ Error fetching sessions:', sessionsError);
    return;
  }

  console.log(`\n📂 Total Sessions: ${sessions?.length || 0}\n`);

  if (!sessions || sessions.length === 0) {
    console.log('   No sessions found for this user.');
    return;
  }

  // Show session details
  for (const session of sessions) {
    const isTarget = sessionId ? session.id === sessionId : false;
    const marker = isTarget ? '👉 ' : '   ';

    // Get message count for this session
    const { count, error: countError } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('session_id', session.id);

    if (countError) {
      console.error(`${marker}❌ Error counting messages:`, countError);
      continue;
    }

    console.log(`${marker}Session: ${session.title}`);
    console.log(`${marker}  ID: ${session.id}`);
    console.log(`${marker}  Messages: ${count || 0}`);
    console.log(`${marker}  Updated: ${new Date(session.updated_at).toLocaleString()}`);

    if (isTarget && count === 0) {
      console.log(`${marker}  ✅ This session has NO messages (successfully cleared)`);
    } else if (isTarget && count && count > 0) {
      console.log(`${marker}  ⚠️  This session still has ${count} messages`);
    }

    console.log();
  }

  // If specific session requested, show detailed message info
  if (sessionId) {
    console.log('─'.repeat(60));
    console.log(`\n📊 Detailed Message Check for Session: ${sessionId}\n`);

    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('❌ Error fetching messages:', messagesError);
      return;
    }

    if (!messages || messages.length === 0) {
      console.log('✅ NO MESSAGES FOUND - Session is empty (successfully cleared)');
    } else {
      console.log(`⚠️  Found ${messages.length} messages (deletion may have failed):\n`);
      messages.forEach((msg, idx) => {
        console.log(`   ${idx + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
        console.log(`      ID: ${msg.id}`);
        console.log(`      Created: ${new Date(msg.created_at).toLocaleString()}`);
        console.log();
      });
    }
  }

  // Summary
  console.log('─'.repeat(60));
  const totalMessages = await getTotalMessageCount(userId);
  console.log(`\n📈 Total Messages for User: ${totalMessages}`);
  console.log('\n✅ Verification Complete\n');
}

async function getTotalMessageCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return count || 0;
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Usage: npx tsx scripts/verify-chat-deletion.ts <user_id> [session_id]');
  console.error('\nExample:');
  console.error('  npx tsx scripts/verify-chat-deletion.ts d5868b7d-11aa-4c3b-b19b-28853d5d5923');
  console.error('  npx tsx scripts/verify-chat-deletion.ts d5868b7d-11aa-4c3b-b19b-28853d5d5923 abc123-session-id');
  process.exit(1);
}

const userId = args[0];
const sessionId = args[1];

verifyChatMessages(userId, sessionId).catch(console.error);
