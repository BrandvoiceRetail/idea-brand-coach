/**
 * Field Sync Status Checker
 * Run this script to check the sync status of all knowledge base fields
 *
 * Usage:
 *   npx tsx scripts/check-field-sync-status.ts <user_id>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ecdrxtbclxfpkknasmrw.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

interface FieldStatus {
  fieldIdentifier: string;
  category: string;
  hasContent: boolean;
  contentLength: number;
  contentPreview: string;
  isCurrent: boolean;
  lastUpdated: string;
  hasSyncedToOpenAI: boolean;
  openaiSyncedAt: string | null;
  openaiFileId: string | null;
}

const ALL_EXPECTED_FIELDS = [
  // Brand Canvas
  { id: 'canvas_brand_purpose', category: 'canvas', name: 'Brand Purpose' },
  { id: 'canvas_brand_vision', category: 'canvas', name: 'Brand Vision' },
  { id: 'canvas_brand_mission', category: 'canvas', name: 'Brand Mission' },
  { id: 'canvas_positioning_statement', category: 'canvas', name: 'Positioning Statement' },
  { id: 'canvas_value_proposition', category: 'canvas', name: 'Value Proposition' },
  { id: 'canvas_brand_voice', category: 'canvas', name: 'Brand Voice' },
  { id: 'canvas_brand_values', category: 'canvas', name: 'Brand Values' },
  { id: 'canvas_brand_personality', category: 'canvas', name: 'Brand Personality' },

  // Avatar Builder
  { id: 'avatar_name', category: 'avatar', name: 'Avatar Name' },
  { id: 'avatar_demographics_age', category: 'avatar', name: 'Age' },
  { id: 'avatar_demographics_income', category: 'avatar', name: 'Income' },
  { id: 'avatar_demographics_location', category: 'avatar', name: 'Location' },
  { id: 'avatar_demographics_lifestyle', category: 'avatar', name: 'Lifestyle' },
  { id: 'avatar_psychology_values', category: 'avatar', name: 'Values' },
  { id: 'avatar_psychology_fears', category: 'avatar', name: 'Fears' },
  { id: 'avatar_psychology_desires', category: 'avatar', name: 'Desires' },
  { id: 'avatar_psychology_triggers', category: 'avatar', name: 'Triggers' },
  { id: 'avatar_buying_behavior_intent', category: 'avatar', name: 'Buyer Intent' },
  { id: 'avatar_buying_behavior_decision_factors', category: 'avatar', name: 'Decision Factors' },
  { id: 'avatar_buying_behavior_shopping_style', category: 'avatar', name: 'Shopping Style' },
  { id: 'avatar_buying_behavior_price_consciousness', category: 'avatar', name: 'Price Consciousness' },
  { id: 'avatar_voice_customer_feedback', category: 'avatar', name: 'Voice of Customer' },
];

async function checkFieldStatus(userId: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('\n🔍 Checking Field Sync Status');
  console.log('================================\n');
  console.log(`User ID: ${userId}\n`);

  // Fetch all entries for this user
  const { data: entries, error } = await supabase
    .from('user_knowledge_base')
    .select('*')
    .eq('user_id', userId)
    .eq('is_current', true);

  if (error) {
    console.error('❌ Error fetching entries:', error);
    return;
  }

  const entryMap = new Map(entries?.map(e => [e.field_identifier, e]) || []);

  console.log(`Total entries in DB: ${entries?.length || 0}\n`);

  // Check each expected field
  const results: FieldStatus[] = [];
  let syncedToSupabase = 0;
  let syncedToOpenAI = 0;
  let withContent = 0;

  for (const field of ALL_EXPECTED_FIELDS) {
    const entry = entryMap.get(field.id);

    if (entry) {
      const status: FieldStatus = {
        fieldIdentifier: field.id,
        category: entry.category,
        hasContent: !!entry.content && entry.content.length > 0,
        contentLength: entry.content?.length || 0,
        contentPreview: entry.content?.substring(0, 50) || '',
        isCurrent: entry.is_current,
        lastUpdated: entry.updated_at,
        hasSyncedToOpenAI: !!entry.openai_file_id,
        openaiSyncedAt: entry.openai_synced_at,
        openaiFileId: entry.openai_file_id,
      };

      results.push(status);

      if (status.hasContent) {
        withContent++;
        syncedToSupabase++;
        if (status.hasSyncedToOpenAI) {
          syncedToOpenAI++;
        }
      }
    } else {
      // Field not in database
      results.push({
        fieldIdentifier: field.id,
        category: field.category,
        hasContent: false,
        contentLength: 0,
        contentPreview: '(not in database)',
        isCurrent: false,
        lastUpdated: '',
        hasSyncedToOpenAI: false,
        openaiSyncedAt: null,
        openaiFileId: null,
      });
    }
  }

  // Print summary
  console.log('📊 SUMMARY');
  console.log('─────────────────────────────────────');
  console.log(`Total Fields:             ${ALL_EXPECTED_FIELDS.length}`);
  console.log(`With Content:             ${withContent} (${Math.round(withContent/ALL_EXPECTED_FIELDS.length * 100)}%)`);
  console.log(`Synced to Supabase:       ${syncedToSupabase} (${Math.round(syncedToSupabase/ALL_EXPECTED_FIELDS.length * 100)}%)`);
  console.log(`Synced to OpenAI:         ${syncedToOpenAI} (${Math.round(syncedToOpenAI/ALL_EXPECTED_FIELDS.length * 100)}%)`);
  console.log('');

  // Print by category
  console.log('\n📋 BY CATEGORY');
  console.log('─────────────────────────────────────\n');

  const categories = ['canvas', 'avatar'];
  for (const category of categories) {
    const categoryFields = results.filter(r => r.category === category);
    const categoryWithContent = categoryFields.filter(r => r.hasContent).length;
    const categoryOpenAI = categoryFields.filter(r => r.hasSyncedToOpenAI).length;

    console.log(`\n${category.toUpperCase()}`);
    console.log(`  Total: ${categoryFields.length}`);
    console.log(`  With Content: ${categoryWithContent}/${categoryFields.length}`);
    console.log(`  Synced to OpenAI: ${categoryOpenAI}/${categoryFields.length}`);
  }

  // Detailed field status
  console.log('\n\n📝 DETAILED FIELD STATUS');
  console.log('─────────────────────────────────────\n');

  for (const result of results) {
    const fieldInfo = ALL_EXPECTED_FIELDS.find(f => f.id === result.fieldIdentifier);
    const statusIcon = result.hasSyncedToOpenAI ? '✅' : result.hasContent ? '⚠️' : '❌';

    console.log(`${statusIcon} ${fieldInfo?.name || result.fieldIdentifier}`);
    console.log(`   Field ID: ${result.fieldIdentifier}`);
    console.log(`   Content: ${result.hasContent ? `${result.contentLength} chars` : 'No content'}`);
    if (result.hasContent) {
      console.log(`   Preview: "${result.contentPreview}${result.contentLength > 50 ? '...' : ''}"`);
    }
    console.log(`   Supabase: ${result.hasContent ? '✅ Synced' : '❌ Not synced'}`);
    console.log(`   OpenAI: ${result.hasSyncedToOpenAI ? `✅ Synced (${result.openaiFileId})` : '❌ Not synced'}`);
    if (result.lastUpdated) {
      console.log(`   Last Updated: ${new Date(result.lastUpdated).toLocaleString()}`);
    }
    console.log('');
  }

  // Show fields that need OpenAI sync
  const needsOpenAISync = results.filter(r => r.hasContent && !r.hasSyncedToOpenAI);
  if (needsOpenAISync.length > 0) {
    console.log('\n⚠️  FIELDS NEEDING OPENAI SYNC');
    console.log('─────────────────────────────────────');
    for (const field of needsOpenAISync) {
      console.log(`  - ${field.fieldIdentifier}`);
    }
    console.log('\nTo sync these fields, run:');
    console.log(`\ncurl -X POST '${SUPABASE_URL}/functions/v1/sync-to-openai-vector-store' \\`);
    console.log(`  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"user_id": "${userId}"}'`);
  }

  // Show missing fields
  const missingFields = results.filter(r => !r.hasContent);
  if (missingFields.length > 0) {
    console.log('\n\n❌ FIELDS NOT YET FILLED');
    console.log('─────────────────────────────────────');
    for (const field of missingFields) {
      const fieldInfo = ALL_EXPECTED_FIELDS.find(f => f.id === field.fieldIdentifier);
      console.log(`  - ${fieldInfo?.name || field.fieldIdentifier} (${field.fieldIdentifier})`);
    }
  }

  console.log('\n');
}

// Main execution
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: npx tsx scripts/check-field-sync-status.ts <user_id>');
  console.error('\nExample:');
  console.error('  npx tsx scripts/check-field-sync-status.ts a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  process.exit(1);
}

checkFieldStatus(userId).catch(console.error);
