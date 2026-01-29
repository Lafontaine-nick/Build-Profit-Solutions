#!/usr/bin/env node

/**
 * Force reload script - sends a reload command to Metro bundler
 * This helps when hot reload isn't working
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8081,
  path: '/reload',
  method: 'GET',
  timeout: 2000
};

const req = http.request(options, (res) => {
  console.log(`✅ Reload command sent - Status: ${res.statusCode}`);
  process.exit(0);
});

req.on('error', (e) => {
  console.log(`❌ Could not connect to Metro bundler on port 8081`);
  console.log(`   Make sure Expo is running: npm run dev`);
  process.exit(1);
});

req.on('timeout', () => {
  console.log(`⏱️  Request timed out - Metro bundler might not be running`);
  process.exit(1);
});

req.end();














