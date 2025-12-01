import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ecdrxtbclxfpkknasmrw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZHJ4dGJjbHhmcGtrbmFzbXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5ODE5ODYsImV4cCI6MjA2OTU1Nzk4Nn0.yPlOSq4l4PMD9RlchTBeXs5EBmzggGQGp7A8B3qGAAk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDiagnosticData(userId: string) {
  console.log(`\n🔍 Checking diagnostic data for user: ${userId}\n`);

  // Check diagnostic_submissions table
  const { data: diagnostics, error: diagError } = await supabase
    .from('diagnostic_submissions')
    .select('*')
    .eq('user_id', userId);

  if (diagError) {
    console.error('❌ Error fetching diagnostics:', diagError);
  } else {
    console.log('📊 Brand Diagnostics:');
    if (diagnostics && diagnostics.length > 0) {
      console.log(`   Found ${diagnostics.length} diagnostic(s)`);
      diagnostics.forEach((diag, index) => {
        console.log(`\n   Diagnostic #${index + 1}:`);
        console.log(`   - ID: ${diag.id}`);
        console.log(`   - Completed: ${diag.completed_at}`);
        console.log(`   - Overall Score: ${diag.scores?.overall}%`);
        console.log(`   - Scores:`, JSON.stringify(diag.scores, null, 2));
        console.log(`   - Answers:`, JSON.stringify(diag.answers, null, 2));
      });
    } else {
      console.log('   ⚠️  No diagnostics found');
    }
  }

  // Check profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('\n❌ Error fetching profile:', profileError);
  } else {
    console.log('\n👤 User Profile:');
    console.log(`   - Email: ${profile.email}`);
    console.log(`   - Created: ${profile.created_at}`);
    console.log(`   - Subscription Tier: ${profile.subscription_tier || 'none'}`);
    console.log(`   - Subscription Status: ${profile.subscription_status || 'none'}`);
  }

  console.log('\n✅ Check complete\n');
}

const userId = process.argv[2] || 'faa7d832-cca5-4735-92c9-36d4199572e6';
checkDiagnosticData(userId);
