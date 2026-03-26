#!/usr/bin/env node
/**
 * Creates backend/.env from env.example if missing, and prints what to edit next.
 * Run from backend: npm run setup:env
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const examplePath = path.join(root, 'env.example');
const envPath = path.join(root, '.env');

if (!fs.existsSync(examplePath)) {
  console.error('Missing env.example in backend folder.');
  process.exit(1);
}

if (fs.existsSync(envPath)) {
  console.log('backend/.env already exists.\n');
  console.log('Edit this file and set your Stripe secret:');
  console.log('  STRIPE_SECRET_KEY=sk_test_...');
  console.log('\nGet it: Stripe Dashboard → Developers → API keys → Secret key (Test mode)\n');
  console.log('File:', envPath);
  process.exit(0);
}

fs.copyFileSync(examplePath, envPath);
console.log('Created backend/.env from env.example\n');
console.log('─── NEXT (billing / subscriptions) ───');
console.log('1. Open this file in Cursor:');
console.log('   ', envPath);
console.log('2. Find STRIPE_SECRET_KEY= and paste your Secret key after the =');
console.log('   (Stripe → Developers → API keys → Reveal test secret key)');
console.log('3. Save the file.');
console.log('4. Start the server:  npm start');
console.log('   (Stop any old backend first with Ctrl+C)\n');
