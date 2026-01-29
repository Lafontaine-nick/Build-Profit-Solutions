# Connection Troubleshooting

## Current Status
- Expo is running in tunnel mode
- Metro bundler is active on port 8081
- Tunnel mode creates a public URL that should work

## How to Connect

### Option 1: Check Terminal for QR Code
Look at the terminal where `npx expo start --tunnel` is running. You should see:
- A QR code
- A URL like `exp://...` or `https://exp.host/...`

### Option 2: Use Expo Go's Recent Projects
1. Open Expo Go app
2. Look for "Recent" or "History" section
3. Your project might be listed there
4. Tap to reconnect

### Option 3: Check Network Connection
Make sure:
- Your phone and computer are on the same WiFi network (for LAN mode)
- OR you're using tunnel mode (works across networks)

### Option 4: Restart Everything
```bash
# Stop everything
pkill -f "expo start"
pkill -f "node.*expo"

# Clear caches
cd mobile
rm -rf .expo node_modules/.cache

# Start fresh
npm run dev
```

## Alternative: Use iOS Simulator
If you have a Mac:
```bash
cd mobile
npm run dev
# Then press 'i' to open iOS Simulator
```

This doesn't require QR codes or network connection.

## Check Terminal Output
The QR code and connection URL should be visible in your terminal. If you don't see it:
- Scroll up in the terminal
- Look for any error messages
- The tunnel might still be initializing (can take 30-60 seconds)














