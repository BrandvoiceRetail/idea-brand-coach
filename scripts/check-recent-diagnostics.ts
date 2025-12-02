import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentDiagnostics() {
  console.log('🔍 Checking recent diagnostic submissions...\n');

  // Get all diagnostic submissions ordered by created_at
  const { data: submissions, error } = await supabase
    .from('diagnostic_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error fetching diagnostics:', error);
    return;
  }

  if (!submissions || submissions.length === 0) {
    console.log('⚠️  No diagnostic submissions found in database');
    return;
  }

  console.log(`📊 Found ${submissions.length} recent diagnostic submission(s):\n`);
  
  submissions.forEach((submission, index) => {
    console.log(`${index + 1}. Diagnostic ID: ${submission.id}`);
    console.log(`   User ID: ${submission.user_id}`);
    console.log(`   Completed: ${submission.completed_at}`);
    console.log(`   Created: ${submission.created_at}`);
    console.log(`   Scores:`, submission.scores);
    console.log(`   Answers:`, submission.answers);
    console.log('');
  });
}

checkRecentDiagnostics();
