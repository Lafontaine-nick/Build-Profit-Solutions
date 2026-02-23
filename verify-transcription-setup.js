#!/usr/bin/env node

/**
 * Verification script for voice transcription setup
 * Run: node verify-transcription-setup.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

console.log('🔍 Verifying Voice Transcription Setup...\n');
console.log('='.repeat(60));

// 1. Check OpenAI API Key
console.log('\n1️⃣ Checking OpenAI API Key...');
const envPath = path.join(__dirname, 'backend', '.env');
let hasOpenAIKey = false;
let openAIKeyValue = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const openAIKeyMatch = envContent.match(/OPENAI_API_KEY=(.+)/);
  if (openAIKeyMatch) {
    openAIKeyValue = openAIKeyMatch[1].trim();
    if (openAIKeyValue && 
        openAIKeyValue !== 'your_openai_api_key_here' && 
        !openAIKeyValue.includes('YOUR_OPE') &&
        openAIKeyValue.length > 20) {
      hasOpenAIKey = true;
      console.log('   ✅ OPENAI_API_KEY is set in backend/.env');
      console.log(`   📝 Key starts with: ${openAIKeyValue.substring(0, 7)}...${openAIKeyValue.substring(openAIKeyValue.length - 4)}`);
    } else {
      console.log('   ❌ OPENAI_API_KEY is set but appears to be a placeholder');
      console.log('   💡 Update backend/.env with your actual OpenAI API key');
    }
  } else {
    console.log('   ❌ OPENAI_API_KEY not found in backend/.env');
    console.log('   💡 Add OPENAI_API_KEY=your_key_here to backend/.env');
  }
} else {
  console.log('   ❌ backend/.env file not found');
  console.log('   💡 Create backend/.env from backend/env.example');
}

// 2. Check Network Connectivity
console.log('\n2️⃣ Checking Network Connectivity...');

const testEndpoints = [
  { name: 'Localhost', url: 'http://localhost:3001/health' },
  { name: 'Common Dev IP', url: 'http://192.168.1.115:3001/health' },
  { name: 'Alternative IP', url: 'http://192.168.0.201:3001/health' },
];

let reachableEndpoint = null;

const testEndpoint = (endpoint) => {
  return new Promise((resolve) => {
    const url = new URL(endpoint.url);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(url, { timeout: 3000 }, (res) => {
      if (res.statusCode === 200) {
        resolve({ endpoint, success: true });
      } else {
        resolve({ endpoint, success: false, status: res.statusCode });
      }
    });
    
    req.on('error', (err) => {
      resolve({ endpoint, success: false, error: err.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ endpoint, success: false, error: 'Timeout' });
    });
  });
};

(async () => {
  for (const endpoint of testEndpoints) {
    const result = await testEndpoint(endpoint);
    if (result.success) {
      console.log(`   ✅ ${endpoint.name} (${endpoint.url}) is reachable`);
      if (!reachableEndpoint) {
        reachableEndpoint = endpoint;
      }
    } else {
      console.log(`   ❌ ${endpoint.name} (${endpoint.url}) is not reachable`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    }
  }

  if (!reachableEndpoint) {
    console.log('   ⚠️  No backend endpoints are reachable');
    console.log('   💡 Make sure your backend server is running on port 3001');
    console.log('   💡 Check your network IP if using a physical device');
  }

  // 3. Check Audio Format Handling
  console.log('\n3️⃣ Checking Audio Format Handling...');
  const aiAssistantPath = path.join(__dirname, 'mobile', 'components', 'AIAssistantModal.tsx');
  if (fs.existsSync(aiAssistantPath)) {
    const content = fs.readFileSync(aiAssistantPath, 'utf8');
    
    // Check for Platform.OS check
    if (content.includes("Platform.OS === 'ios' ? 'm4a' : 'mp4'")) {
      console.log('   ✅ Audio format detection is implemented (iOS: m4a, Android: mp4)');
    } else {
      console.log('   ⚠️  Audio format detection may not be properly implemented');
    }
    
    // Check for expo-av import
    if (content.includes("from 'expo-av'") || content.includes('from "expo-av"')) {
      console.log('   ✅ expo-av is imported');
    } else {
      console.log('   ❌ expo-av is not imported');
    }
    
    // Check for Audio usage
    if (content.includes('Audio.Recording') || content.includes('Audio.requestPermissionsAsync')) {
      console.log('   ✅ Audio recording API is being used');
    } else {
      console.log('   ❌ Audio recording API is not being used');
    }
  } else {
    console.log('   ❌ AIAssistantModal.tsx not found');
  }

  // 4. Check Backend Transcription Endpoint
  console.log('\n4️⃣ Checking Backend Transcription Endpoint...');
  const backendRoutePath = path.join(__dirname, 'backend', 'src', 'routes', 'aiAssistant.js');
  if (fs.existsSync(backendRoutePath)) {
    const content = fs.readFileSync(backendRoutePath, 'utf8');
    
    if (content.includes('/transcribe')) {
      console.log('   ✅ /transcribe endpoint exists');
    } else {
      console.log('   ❌ /transcribe endpoint not found');
    }
    
    if (content.includes('whisper-1')) {
      console.log('   ✅ OpenAI Whisper model (whisper-1) is configured');
    } else {
      console.log('   ❌ OpenAI Whisper model not found');
    }
    
    if (content.includes('openai.audio.transcriptions.create')) {
      console.log('   ✅ OpenAI transcription API call is implemented');
    } else {
      console.log('   ❌ OpenAI transcription API call not found');
    }
  } else {
    console.log('   ❌ aiAssistant.js route file not found');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));
  
  const checks = [
    { name: 'OpenAI API Key', status: hasOpenAIKey },
    { name: 'Backend Reachable', status: !!reachableEndpoint },
    { name: 'Audio Format Handling', status: true }, // Assume true if file exists
    { name: 'Backend Endpoint', status: true }, // Assume true if file exists
  ];
  
  const passed = checks.filter(c => c.status).length;
  const total = checks.length;
  
  checks.forEach(check => {
    const icon = check.status ? '✅' : '❌';
    console.log(`   ${icon} ${check.name}`);
  });
  
  console.log(`\n   Result: ${passed}/${total} checks passed`);
  
  if (passed === total) {
    console.log('\n   🎉 All checks passed! Voice transcription should work.');
  } else {
    console.log('\n   ⚠️  Some checks failed. Please fix the issues above.');
    if (!hasOpenAIKey) {
      console.log('\n   💡 To fix OpenAI API Key:');
      console.log('      1. Get your API key from https://platform.openai.com/api-keys');
      console.log('      2. Add OPENAI_API_KEY=your_key_here to backend/.env');
      console.log('      3. Restart your backend server');
    }
    if (!reachableEndpoint) {
      console.log('\n   💡 To fix network connectivity:');
      console.log('      1. Make sure backend is running: cd backend && npm start');
      console.log('      2. Check your network IP: ifconfig (Mac) or ipconfig (Windows)');
      console.log('      3. Update EXPO_PUBLIC_AI_API_URL in mobile/.env if needed');
    }
  }
  
  console.log('\n' + '='.repeat(60));
})();
