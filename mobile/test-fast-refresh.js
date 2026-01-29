// Quick test to see if Metro detects file changes
// Run: node test-fast-refresh.js

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'TeamTab.tsx');

console.log('Watching for changes to TeamTab.tsx...');
console.log('Make a change to the file and save it.');
console.log('If Metro detects it, you should see "Bundling..." in the Metro terminal.\n');

fs.watchFile(filePath, { interval: 1000 }, (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    console.log('✅ File changed detected!');
    console.log(`   Modified: ${curr.mtime}`);
    console.log('   Check Metro terminal for "Bundling..." message\n');
  }
});

console.log('Watching... (Press Ctrl+C to stop)');














