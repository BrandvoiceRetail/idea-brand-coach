/**
 * Clear Browser Storage Script
 * Run this in the browser console to clear IndexedDB
 *
 * Usage:
 *   1. Open DevTools console (F12)
 *   2. Copy and paste this entire script
 *   3. Press Enter
 */

(async function clearBrowserStorage() {
  console.log('🗑️  Clearing browser storage...\n');

  try {
    // Clear IndexedDB
    console.log('Deleting IndexedDB: idea-brand-coach...');
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('idea-brand-coach');
      request.onsuccess = () => {
        console.log('✅ IndexedDB deleted');
        resolve(true);
      };
      request.onerror = () => {
        console.error('❌ Failed to delete IndexedDB');
        reject(request.error);
      };
      request.onblocked = () => {
        console.warn('⚠️  Delete blocked - close other tabs using this database');
        reject(new Error('Delete blocked'));
      };
    });

    console.log('\n✅ Browser storage cleared!');
    console.log('\n📋 Next step: Refresh the page');
    console.log('Press Cmd+R (Mac) or Ctrl+R (Windows)\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.log('\nManual steps:');
    console.log('1. DevTools → Application → IndexedDB');
    console.log('2. Right-click "idea-brand-coach" → Delete');
    console.log('3. Refresh page');
  }
})();
