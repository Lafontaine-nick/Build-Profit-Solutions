#!/usr/bin/env node
/**
 * Creates a tiny backend/.env (only PORT + STRIPE_SECRET_KEY) so you can paste one key.
 * Run: npm run setup:env:simple
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const minimal = path.join(root, 'env.minimal.example');
const envPath = path.join(root, '.env');

if (!fs.existsSync(minimal)) {
  console.error('Missing env.minimal.example');
  process.exit(1);
}

if (fs.existsSync(envPath)) {
  console.log('You already have backend/.env\n');
  console.log('Do this only:');
  console.log('  1. Open: backend/.env');
  console.log('  2. Find the line:  STRIPE_SECRET_KEY=');
  console.log('  3. Paste your key right after the = with no space');
  console.log('     Example:  STRIPE_SECRET_KEY=sk_test_abc...');
  console.log('  4. Save. Then run:  npm start\n');
  console.log('File:', envPath);
  process.exit(0);
}

fs.copyFileSync(minimal, envPath);
console.log('Created backend/.env (only PORT + STRIPE_SECRET_KEY).\n');
console.log('Do this only:');
console.log('  1. Open: backend/.env  in Cursor');
console.log('  2. On the line STRIPE_SECRET_KEY=  paste your secret after the =');
console.log('  3. Save. Then run:  npm start\n');
console.log('File:', envPath);
