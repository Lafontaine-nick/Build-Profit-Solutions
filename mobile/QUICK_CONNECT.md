# Quick Connect Guide

## Metro Web Interface
I just opened `http://localhost:8081` in your browser. This should show:
- Connection info
- QR code
- URLs you can use

## Direct Connection Methods

### Method 1: Metro Web Interface
1. Open browser to: `http://localhost:8081`
2. You should see connection info and QR code there
3. Scan the QR code or copy the URL

### Method 2: Check Your Terminal
Look at the terminal window where Expo is running. The QR code should be displayed there as ASCII art.

### Method 3: Use Expo Go Recent Projects
1. Open Expo Go app
2. Check "Recent" or "History" 
3. Your project should be listed
4. Tap to reconnect

### Method 4: Manual URL Entry
In Expo Go:
1. Tap the "+" or "Enter URL manually"
2. Try: `exp://192.168.0.201:8081`
3. Or check terminal for the exact URL

## If Nothing Works

Try iOS Simulator (if on Mac):
```bash
cd mobile
npm run dev
# Press 'i' when prompted
```

This opens the app directly in the simulator - no QR code needed.














