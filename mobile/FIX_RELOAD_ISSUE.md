# Fix: Reload Not Working - Need Full App Restart

## The Problem

Even manual reload (shake → reload) doesn't work. You have to completely restart Expo Go app to see changes.

This suggests:
- Metro bundler might not be serving updated bundles
- Expo Go is caching bundles aggressively
- Connection between Expo Go and Metro might be broken

## Solution: Force Bundle Updates

### Option 1: Use Tunnel Mode (More Reliable)

```bash
# Stop current Expo
pkill -f "expo start"

# Start with tunnel mode
cd mobile
npm run dev:tunnel
```

Tunnel mode creates a more stable connection and forces bundle updates.

### Option 2: Clear Expo Go Cache

In Expo Go:
1. Shake device
2. Settings → "Clear cache"
3. Then reload

### Option 3: Use Development Build

This is the most reliable solution:

```bash
# Install Xcode (if on Mac)
# Then:
cd mobile
npx expo run:ios
```

Development builds have much more reliable hot reload and don't have the caching issues of Expo Go.

### Option 4: Force Metro to Rebuild

Add this to force Metro to always rebuild:

```bash
# Stop Expo
pkill -f "expo start"

# Clear everything
rm -rf .expo node_modules/.cache .metro-cache

# Start with --clear flag (forces fresh bundle)
npx expo start --clear
```

## Immediate Fix to Try

1. **Stop Expo completely:**
   ```bash
   pkill -f "expo start"
   ```

2. **Clear all caches:**
   ```bash
   cd mobile
   rm -rf .expo node_modules/.cache .metro-cache
   ```

3. **Start with tunnel mode:**
   ```bash
   npm run dev:tunnel
   ```

4. **In Expo Go:**
   - Close the app completely
   - Reopen Expo Go
   - Scan QR code
   - Clear cache (shake → Settings → Clear cache)
   - Then test

## Why This Happens

Expo Go aggressively caches bundles to save bandwidth. Sometimes it doesn't detect that a new bundle is available, so it serves the old cached one even after reload.

Tunnel mode or development builds bypass this caching issue.














