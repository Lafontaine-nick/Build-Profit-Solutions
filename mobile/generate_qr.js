const qrcode = require('qrcode-terminal');

// Common Expo development URLs
const urls = [
  'exp://192.168.1.100:8083',
  'exp://localhost:8083',
  'exp://127.0.0.1:8083',
  'exp://10.0.0.1:8083',
];

console.log('🔗 Expo Development URLs:');
console.log('========================\n');

urls.forEach((url, index) => {
  console.log(`${index + 1}. ${url}`);
  console.log('QR Code:');
  qrcode.generate(url, { small: true });
  console.log('\n' + '='.repeat(50) + '\n');
});

console.log('📱 Instructions:');
console.log('1. Open Expo Go app on your phone');
console.log('2. Tap "Scan QR Code"');
console.log('3. Try scanning the QR codes above');
console.log("4. If one doesn't work, try the next one");
