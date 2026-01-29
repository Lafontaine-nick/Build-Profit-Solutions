# Enable Automatic Hot Reload

## The Issue
Expo Go on physical devices has limitations with automatic hot reload. Here's how to improve it:

## Quick Fix - Enable Fast Refresh

### In Expo Go App:
1. **Shake your device**
2. Tap **"Settings"**
3. Make sure **"Fast Refresh"** is **ON** ✅
4. Make sure **"Auto Reload"** is **ON** ✅

### Restart Expo Without --clear Flag

The `--clear` flag breaks hot reload. Use this instead:

```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npx expo start --tunnel
```

**OR** for better reliability on same network:

```bash
npx expo start --lan
```

## Why Manual Reload is Sometimes Needed

**Expo Go on physical devices** has these limitations:
- Network dependency (WiFi → Computer → Metro)
- Bundle caching in Expo Go
- Connection stability issues

## Best Solution: Use iOS Simulator

For **automatic hot reload** that works reliably:

```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npx expo start
# Press 'i' to open iOS Simulator
```

**Benefits:**
- ✅ Automatic hot reload (no shaking needed)
- ✅ No network dependency
- ✅ More reliable
- ✅ Faster development

## Alternative: Development Build

For production-like experience with best hot reload:

```bash
npx expo run:ios
```

This creates a custom development client with much better hot reload than Expo Go.




























