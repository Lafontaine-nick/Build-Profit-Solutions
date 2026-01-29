const qrcode = require('qrcode-terminal');

// Your actual IP address
const yourIP = '192.168.0.201';
const port = '8083';

// Generate QR codes with your actual IP
const urls = [
  `exp://${yourIP}:${port}`,
  `exp://localhost:${port}`,
  `exp://127.0.0.1:${port}`,
];

console.log('🔗 Correct Expo Development URLs:');
console.log('==================================\n');
console.log(`Your IP Address: ${yourIP}`);
console.log(`Port: ${port}\n`);

urls.forEach((url, index) => {
  console.log(`${index + 1}. ${url}`);
  console.log('QR Code:');
  qrcode.generate(url, { small: true });
  console.log('\n' + '='.repeat(60) + '\n');
});

console.log('📱 Instructions:');
console.log(
  '1. Make sure your phone and computer are on the same WiFi network'
);
console.log('2. Open Expo Go app on your phone');
console.log('3. Tap "Scan QR Code"');
console.log('4. Try the FIRST QR code (with your IP address)');
console.log("5. If that doesn't work, try the localhost ones");
console.log('\n🔧 Troubleshooting:');
console.log('- Check that both devices are on the same WiFi');
console.log('- Make sure Expo server is running (npm start)');
console.log('- Try restarting the Expo server if needed');
