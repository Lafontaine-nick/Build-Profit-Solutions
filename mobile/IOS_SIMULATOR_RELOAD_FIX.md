# iOS Simulator Not Showing Changes - Quick Fix

## Immediate Solutions

### Option 1: Reload in Simulator (Fastest)
1. **In the iOS Simulator**, press: `Cmd + R` (reload)
2. Or: `Cmd + K` (clear cache and reload)
3. Changes should appear immediately

### Option 2: Reload from Metro Terminal
In the terminal where Metro is running:
- Press `r` to reload
- Press `R` to reload and clear cache

### Option 3: Restart Metro with Clear Cache
```bash
# Stop Metro (Ctrl+C)
cd mobile
npx expo start --clear
# Press 'i' to reopen simulator
```

## Why This Happens

1. **Cached Bundle**: Simulator may have cached the old bundle
2. **Fast Refresh Blocked**: TypeScript errors can block automatic reload
3. **Metro Not Detecting**: File changes might not be detected
4. **Stale Connection**: Simulator might be connected to old Metro instance

## Check What's Happening

### 1. Watch Metro Terminal
When you save a file, you should see:
```
Bundling...
Bundled in Xms
```

If you don't see this, Metro isn't detecting your changes.

### 2. Check for Errors
Look for red error messages in Metro terminal. TypeScript/JavaScript errors can block reload.

### 3. Verify Simulator is Connected
In Metro terminal, you should see:
```
› Metro waiting on exp://...
› Scan the QR code above with Expo Go
```

## Best Practice

**For iOS Simulator development:**
1. Make your edit
2. Save the file
3. **Press `Cmd + R` in simulator** (reload)
4. See changes immediately ✅

This is more reliable than waiting for automatic Fast Refresh.

## If Still Not Working

### Full Reset:
```bash
# Stop Metro
cd mobile
rm -rf .expo
rm -rf node_modules/.cache
npx expo start --clear
# Press 'i' to open simulator
```

### Check TypeScript Errors:
```bash
cd mobile
npx tsc --noEmit
# Fix any errors - they block hot reload
```
