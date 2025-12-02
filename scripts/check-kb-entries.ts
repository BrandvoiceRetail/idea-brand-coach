/**
 * Check knowledge base entries for a user
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKnowledgeBase(userId: string) {
  console.log('🔍 Checking Knowledge Base Entries');
  console.log('================================\n');

  const { data: entries, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!entries || entries.length === 0) {
    console.log('✅ No knowledge base entries');
    return;
  }

  console.log(`Total entries: ${entries.length}\n`);

  // Group by category
  const byCategory = entries.reduce((acc, entry) => {
    const cat = entry.category || 'uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(entry);
    return acc;
  }, {} as Record<string, any[]>);

  // Show entries by category
  for (const [category, catEntries] of Object.entries(byCategory)) {
    console.log(`\n📁 Category: ${category} (${catEntries.length} entries)`);
    console.log('─'.repeat(80));

    for (const entry of catEntries) {
      const contentPreview = entry.content?.substring(0, 100) || '(empty)';
      console.log(`\nField: ${entry.field_identifier}`);
      console.log(`Content: ${contentPreview}${entry.content?.length > 100 ? '...' : ''}`);
      console.log(`Subcategory: ${entry.subcategory || 'none'}`);
    }
  }

  // Show completion stats
  console.log('\n\n📊 Completion Analysis');
  console.log('─'.repeat(80));

  for (const [category, catEntries] of Object.entries(byCategory)) {
    const filled = catEntries.filter(e => e.content && e.content.trim().length > 0).length;
    const total = catEntries.length;
    const pct = Math.round((filled / total) * 100);
    console.log(`${category}: ${filled}/${total} fields (${pct}%)`);
  }
}

// Get user ID from command line
const userId = process.argv[2] || 'd5868b7d-11aa-4c3b-b19b-28853d5d5923';
checkKnowledgeBase(userId);
