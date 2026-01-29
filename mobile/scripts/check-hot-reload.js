#!/usr/bin/env node

/**
 * Health check script to verify hot reload setup
 */

const fs = require('fs');
const path = require('path');

const checks = [];
let allPassed = true;

// Check 1: Metro config exists and has proper settings
const metroConfigPath = path.join(__dirname, '..', 'metro.config.js');
if (fs.existsSync(metroConfigPath)) {
  const metroConfig = fs.readFileSync(metroConfigPath, 'utf8');
  if (metroConfig.includes('watchFolders')) {
    checks.push({ name: 'Metro config has watchFolders', status: '✅' });
  } else {
    checks.push({ name: 'Metro config has watchFolders', status: '❌' });
    allPassed = false;
  }
  
  // Check if resetCache is actually used (not just in comments)
  const hasResetCacheInCode = /resetCache\s*[:=]/.test(metroConfig);
  if (!hasResetCacheInCode) {
    checks.push({ name: 'Metro config does not use resetCache in code', status: '✅' });
  } else {
    checks.push({ name: 'Metro config does not use resetCache in code', status: '❌' });
    allPassed = false;
  }
} else {
  checks.push({ name: 'Metro config exists', status: '❌' });
  allPassed = false;
}

// Check 2: Watchman config exists
const watchmanConfigPath = path.join(__dirname, '..', '.watchmanconfig');
if (fs.existsSync(watchmanConfigPath)) {
  checks.push({ name: '.watchmanconfig exists', status: '✅' });
} else {
  checks.push({ name: '.watchmanconfig exists', status: '⚠️  (optional)' });
}

// Check 3: Package.json dev script doesn't use --clear by default
const packageJsonPath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const devScript = packageJson.scripts?.dev || '';
  if (devScript.includes('--clear')) {
    checks.push({ name: 'dev script does not use --clear by default', status: '❌' });
    allPassed = false;
  } else {
    checks.push({ name: 'dev script does not use --clear by default', status: '✅' });
  }
}

// Check 4: Babel config exists
const babelConfigPath = path.join(__dirname, '..', 'babel.config.js');
if (fs.existsSync(babelConfigPath)) {
  checks.push({ name: 'Babel config exists', status: '✅' });
} else {
  checks.push({ name: 'Babel config exists', status: '❌' });
  allPassed = false;
}

// Print results
console.log('\n🔍 Hot Reload Configuration Check\n');
console.log('='.repeat(50));
checks.forEach(check => {
  console.log(`${check.status} ${check.name}`);
});
console.log('='.repeat(50));

if (allPassed) {
  console.log('\n✅ All critical checks passed! Hot reload should work.\n');
  process.exit(0);
} else {
  console.log('\n❌ Some checks failed. Please review the configuration.\n');
  process.exit(1);
}














