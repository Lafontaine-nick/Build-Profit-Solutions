# Enable Automatic Fast Refresh (No Shaking Required)

## Quick Fix Steps

### 1. Enable Fast Refresh in Expo Go App

**On your physical device:**
1. Open the Expo Go app
2. Shake your device OR long-press the screen
3. Tap **"Settings"**
4. Make sure **"Fast Refresh"** is **ON** ✅
5. Make sure **"Auto Reload"** is **ON** ✅ (if available)

### 2. Restart Expo Development Server

Stop your current Expo server (Ctrl+C in terminal) and restart:

```bash
cd mobile
npm run dev
```

### 3. Verify Fast Refresh is Working

1. Make a small edit to any component (e.g., change text color or text)
2. Save the file
3. **Changes should appear automatically within 1-2 seconds** - no shaking needed!

## What Changed

- ✅ Updated Metro config to enable proper Fast Refresh
- ✅ Removed aggressive cache disabling that was blocking hot reload
- ✅ Configured proper file watching
- ✅ Dev script already doesn't use `--clear` flag (which breaks hot reload)

## If Fast Refresh Still Doesn't Work

### Check Metro Terminal Output
When you save a file, you should see:
```
Bundling JavaScript bundle...
```

If you don't see this, Metro isn't detecting your file changes.

### Try These Steps:

1. **Clear cache and restart:**
   ```bash
   npm run dev:clear
   ```

2. **Use LAN mode instead of tunnel** (if on same WiFi):
   ```bash
   npm run dev:lan
   ```

3. **Full reset** (if still not working):
   ```bash
   npm run dev:reset
   ```

## Notes

- **Physical devices:** Fast Refresh works automatically once enabled in Expo Go settings
- **iOS Simulator:** Works automatically without any settings changes
- **Network:** Tunnel mode works but LAN mode is faster if on same network

## Testing

After enabling Fast Refresh in Expo Go, test it:
1. Open `estimate-generator.jsx`
2. Change a text color or text content
3. Save the file
4. Watch your device - changes should appear automatically! 🎉
