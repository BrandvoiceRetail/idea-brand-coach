/**
 * Direct database check - checks ALL tables for this user
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ecdrxtbclxfpkknasmrw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZHJ4dGJjbHhmcGtrbmFzbXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5ODE5ODYsImV4cCI6MjA2OTU1Nzk4Nn0.yPlOSq4l4PMD9RlchTBeXs5EBmzggGQGp7A8B3qGAAk';

async function checkDatabase(): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const userId = 'd5868b7d-11aa-4c3b-b19b-28853d5d5923';

  console.log('\n🔍 DIRECT DATABASE CHECK');
  console.log('================================');
  console.log(`User: ${userId}\n`);

  // Check chat_messages
  const { data: chatData, count: chatCount } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  console.log('📧 chat_messages:');
  console.log(`   Total: ${chatCount || 0}`);
  if (chatData && chatData.length > 0) {
    console.log('   ⚠️  FOUND MESSAGES:');
    chatData.forEach((msg, i) => {
      console.log(`   ${i + 1}. [${msg.chatbot_type}] ${msg.role}: ${msg.content.substring(0, 50)}...`);
    });
  }

  // Check ALL chat_messages (any chatbot_type)
  const { data: allChat, count: allCount } = await supabase
    .from('chat_messages')
    .select('chatbot_type, role, content, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\n📧 ALL chat_messages for this user:');
  console.log(`   Total: ${allCount || 0}`);
  if (allChat && allChat.length > 0) {
    allChat.forEach((msg, i) => {
      console.log(`   ${i + 1}. Type: ${msg.chatbot_type}`);
      console.log(`      Role: ${msg.role}`);
      console.log(`      Created: ${msg.created_at}`);
      console.log(`      Content: ${msg.content.substring(0, 60)}...`);
    });
  }

  // Check user_knowledge_base
  const { data: kbData, count: kbCount } = await supabase
    .from('user_knowledge_base')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  console.log('\n📚 user_knowledge_base:');
  console.log(`   Total: ${kbCount || 0}`);
  if (kbData && kbData.length > 0) {
    console.log('   Entries:');
    kbData.slice(0, 5).forEach((entry, i) => {
      console.log(`   ${i + 1}. ${entry.field_identifier}: ${entry.content.substring(0, 50)}...`);
    });
  }

  console.log('\n================================');
  console.log('Summary:');
  console.log(`  Chat messages: ${chatCount || 0}`);
  console.log(`  Knowledge base entries: ${kbCount || 0}`);
  console.log('');
}

checkDatabase().catch(console.error);
