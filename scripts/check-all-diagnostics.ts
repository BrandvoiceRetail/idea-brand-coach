import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ecdrxtbclxfpkknasmrw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZHJ4dGJjbHhmcGtrbmFzbXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5ODE5ODYsImV4cCI6MjA2OTU1Nzk4Nn0.yPlOSq4l4PMD9RlchTBeXs5EBmzggGQGp7A8B3qGAAk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllDiagnostics() {
  console.log('\n🔍 Checking all diagnostic data in the system...\n');

  // Get all diagnostics
  const { data: diagnostics, error: diagError } = await supabase
    .from('diagnostic_submissions')
    .select('*')
    .order('completed_at', { ascending: false });

  if (diagError) {
    console.error('❌ Error fetching diagnostics:', diagError);
    return;
  }

  console.log(`📊 Total Diagnostics: ${diagnostics?.length || 0}\n`);

  if (diagnostics && diagnostics.length > 0) {
    diagnostics.forEach((diag, index) => {
      console.log(`Diagnostic #${index + 1}:`);
      console.log(`  - ID: ${diag.id}`);
      console.log(`  - User ID: ${diag.user_id}`);
      console.log(`  - Completed: ${diag.completed_at}`);
      console.log(`  - Scores:`, JSON.stringify(diag.scores, null, 2));
      console.log('');
    });
  } else {
    console.log('⚠️  No diagnostics found in the system');
  }

  console.log('✅ Check complete\n');
}

checkAllDiagnostics();
