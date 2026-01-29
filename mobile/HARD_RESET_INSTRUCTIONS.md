# Hard Reset Instructions - Fix Bundle Not Updating

## What I Just Did

1. ✅ Stopped all Expo processes
2. ✅ Cleared all caches (.expo, node_modules/.cache, .metro-cache)
3. ⏳ Next: Restart Expo with fresh cache

## What You Need to Do

### Step 1: Restart Expo
Run this command in your terminal:
```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npx expo start --tunnel --clear
```

Wait for:
- QR code to appear
- "Metro waiting on exp://..." message

### Step 2: In Expo Go App
1. **Completely close Expo Go:**
   - Swipe up on the app
   - Remove it from app switcher
   - Make sure it's fully closed

2. **Reopen Expo Go:**
   - Open the app fresh
   - Scan the NEW QR code from terminal
   - Wait for app to load

3. **Clear Expo Go Cache:**
   - Shake your device
   - Tap "Settings"
   - Tap "Clear cache" (if available)
   - Then reload

### Step 3: Test the Edit
1. Navigate to Bid Summary page
2. Look for "Total Bid [TEST EDIT]" at the top
3. Look for "Bid Summary [SIMPLE TEST]" in the title

## Why This Works

- **Cleared caches:** Removes old cached bundles
- **--clear flag:** Forces Metro to rebuild everything
- **Tunnel mode:** More reliable connection
- **Fresh Expo Go connection:** Forces download of new bundle

## If Still Not Working

The issue might be that Expo Go is too aggressive with caching. Try:

1. **Uninstall and reinstall Expo Go** (nuclear option)
2. **Use iOS Simulator** instead (more reliable):
   ```bash
   npx expo start --clear
   # Then press 'i' to open simulator
   ```
3. **Create a development build** (most reliable):
   ```bash
   npx expo run:ios
   ```

## Current Status

- ✅ Caches cleared
- ✅ Expo stopped
- ⏳ Waiting for you to restart Expo with `--clear` flag





