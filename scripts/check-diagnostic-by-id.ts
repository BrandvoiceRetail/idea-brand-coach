import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const submissionId = process.argv[2];

async function checkDiagnosticById() {
  console.log(`🔍 Checking diagnostic submission: ${submissionId}\n`);

  const { data: submission, error } = await supabase
    .from('diagnostic_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (error) {
    console.error('❌ Error fetching diagnostic:', error);
    return;
  }

  if (!submission) {
    console.log('⚠️  No diagnostic found with that ID');
    return;
  }

  console.log('📊 Diagnostic Submission Found:');
  console.log(`   ID: ${submission.id}`);
  console.log(`   User ID: ${submission.user_id}`);
  console.log(`   Completed: ${submission.completed_at}`);
  console.log(`   Created: ${submission.created_at}`);
  console.log(`   Scores:`, submission.scores);
  console.log(`   Answers:`, submission.answers);
}

checkDiagnosticById();
