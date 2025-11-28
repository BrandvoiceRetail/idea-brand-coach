/**
 * Debug Chat Page
 * Paste this in browser console to see what's happening
 */

console.log('🔍 CHAT PAGE DEBUG INFO');
console.log('================================\n');

// Check authentication
const authData = localStorage.getItem('sb-ecdrxtbclxfpkknasmrw-auth-token');
if (authData) {
  try {
    const parsed = JSON.parse(authData);
    console.log('✅ Logged in user:');
    console.log('   User ID:', parsed.user?.id || 'Unknown');
    console.log('   Email:', parsed.user?.email || 'Unknown');
  } catch (e) {
    console.log('❌ Could not parse auth data');
  }
} else {
  console.log('❌ Not logged in');
}

// Check for any stored state
console.log('\n📦 LocalStorage keys:');
Object.keys(localStorage).forEach(key => {
  console.log('  -', key);
});

console.log('\n📦 SessionStorage keys:');
Object.keys(sessionStorage).forEach(key => {
  console.log('  -', key);
});

// Check IndexedDB
indexedDB.databases().then(dbs => {
  console.log('\n💾 IndexedDB databases:');
  dbs.forEach(db => {
    console.log('  -', db.name, 'v' + db.version);
  });
});

// Check React component state (if available)
setTimeout(() => {
  console.log('\n🔍 Looking for React state...');
  const root = document.querySelector('[id*="root"]') || document.body;
  console.log('Root element:', root);
  console.log('\nIf you see conversation history, please:');
  console.log('1. Take a screenshot');
  console.log('2. Check browser console for any errors');
  console.log('3. Verify the user ID above matches:', 'd5868b7d-11aa-4c3b-b19b-28853d5d5923');
}, 1000);
