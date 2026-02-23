# Why Expo Go and iOS Simulator Show Different Content

## The Problem

Expo Go and iOS Simulator can show different versions of your app because they:
1. **Use different connection methods** (network vs localhost)
2. **Have different caching behavior**
3. **May connect to different Metro bundler instances**
4. **Cache bundles differently**

## Quick Fixes

### Fix 1: Clear All Caches

```bash
# Stop all Metro bundlers
# Press Ctrl+C in all terminal windows running Metro

# Clear Expo cache
cd mobile
npx expo start --clear

# Or clear everything
rm -rf node_modules/.cache
rm -rf .expo
npx expo start --clear
```

### Fix 2: Restart Both Connections

1. **Close Expo Go completely** on your phone (swipe up, force quit)
2. **Close iOS Simulator** (if open)
3. **Restart Metro with clear cache:**
   ```bash
   cd mobile
   npx expo start --clear
   ```
4. **Reconnect both:**
   - Scan QR code in Expo Go
   - Press 'i' for iOS Simulator

### Fix 3: Use Same Metro Instance

Make sure both are connecting to the **same Metro bundler**:

```bash
# Start ONE Metro instance
cd mobile
npx expo start

# Then:
# - Scan QR code for Expo Go
# - Press 'i' for iOS Simulator
```

**Don't run multiple Metro instances!**

## Why This Happens

### Expo Go (Physical Device)
- ✅ Connects via WiFi/network
- ❌ Caches bundles aggressively
- ❌ May use stale cache
- ❌ Network latency can cause sync issues

### iOS Simulator
- ✅ Connects via localhost (faster)
- ✅ Less aggressive caching
- ✅ Better hot reload
- ✅ More reliable updates

## Best Practice

**For development, use iOS Simulator:**
```bash
cd mobile
npx expo start
# Press 'i' when prompted
```

**For testing on physical device:**
```bash
cd mobile
npx expo start --clear
# Scan QR code
# After making changes, manually reload in Expo Go
```

## Force Sync Both

If you need both to show the same content:

1. **Make your code changes**
2. **Save all files**
3. **Stop Metro** (Ctrl+C)
4. **Clear cache and restart:**
   ```bash
   cd mobile
   npx expo start --clear
   ```
5. **Reconnect both devices:**
   - Expo Go: Scan new QR code
   - Simulator: Press 'i' or reload

## Check What They're Loading

Add this to see which version each is loading:

```typescript
// In your app (temporarily)
import Constants from 'expo-constants';

console.log('App Version:', Constants.expoConfig?.version);
console.log('Build Time:', new Date().toISOString());
console.log('Platform:', Constants.platform);
console.log('Is Device:', Constants.isDevice);
```

This will help you see if they're loading different bundles.
