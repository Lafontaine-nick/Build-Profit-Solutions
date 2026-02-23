#!/usr/bin/env node

/**
 * Quick script to check authentication token status
 * Run this from the project root: node check-auth-status.js
 */

const readline = require('readline');

console.log('🔍 Authentication Status Checker\n');
console.log('This script helps you check if authentication tokens are properly configured.\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function checkBackendHealth() {
  console.log('📡 Checking backend health...');
  const http = require('http');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/health',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ Backend is running and healthy');
        try {
          const health = JSON.parse(data);
          console.log('   Status:', health.status);
          console.log('   Environment:', health.environment);
        } catch (e) {
          console.log('   Response:', data);
        }
      } else {
        console.log('⚠️  Backend responded with status:', res.statusCode);
      }
      rl.close();
    });
  });

  req.on('error', (error) => {
    console.log('❌ Backend is not reachable:', error.message);
    console.log('   Make sure the backend is running on port 3001');
    rl.close();
  });

  req.end();
}

function showInstructions() {
  console.log('\n📋 How to Check Auth Status in Your App:\n');
  console.log('1. Open your app in development mode');
  console.log('2. Open React Native Debugger or Chrome DevTools');
  console.log('3. In the console, run:\n');
  console.log('   import { debugAuthStatus } from "./mobile/utils/authTokenHelper";');
  console.log('   await debugAuthStatus();\n');
  console.log('Or add this to any screen temporarily:\n');
  console.log('   import { checkAuthTokenStatus } from "@/utils/authTokenHelper";');
  console.log('   const status = await checkAuthTokenStatus();');
  console.log('   console.log(status);\n');
  console.log('📖 See AUTH_DEBUG_GUIDE.md for detailed instructions\n');
}

function main() {
  rl.question('Do you want to check backend health? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      checkBackendHealth();
    } else {
      showInstructions();
      rl.close();
    }
  });
}

main();
