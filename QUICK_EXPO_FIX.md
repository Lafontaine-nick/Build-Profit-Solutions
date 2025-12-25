# Quick Fix: Expo Edits Not Showing

## ✅ What I Fixed

I've updated your default `dev` script to use **tunnel mode** instead of LAN mode. This should make hot reload more reliable on physical devices.

## 🚀 How to Use Now

### For Physical Device (Default - Now Uses Tunnel)
```bash
cd mobile
npm run dev
```

This now uses tunnel mode automatically, which:
- ✅ Works across different networks
- ✅ More reliable connection
- ✅ Better for physical devices
- ⚠️ Slightly slower initial connection (30-60 seconds)

### For iOS Simulator (Fastest & Most Reliable)
```bash
cd mobile
npm run dev
# Then press 'i' to open iOS Simulator
```

### For LAN Mode (If Same WiFi & Fast)
```bash
cd mobile
npm run dev:lan
```

## 📱 How to See Your Changes

### On Physical Device:
1. Make your edit
2. Save the file
3. **Shake device** → Tap "Reload"
4. Wait 5-10 seconds
5. See changes ✅

**Note:** Expo Go on physical devices requires manual reloads. This is normal.

### On iOS Simulator:
1. Make your edit
2. Save the file
3. Changes appear automatically ✅

## 🔍 Verify It's Working

When you run `npm run dev`, look for:
- ✅ `Metro waiting on exp://...exp.direct/...` (Tunnel mode)
- ✅ QR code appears in terminal
- ✅ When you save a file, Metro shows "Bundling..."

## 🛠️ If Still Not Working

### Clear Cache and Restart:
```bash
cd mobile
npm run dev:reset
```

### Check Connection Mode:
```bash
cd mobile
./check-connection-mode.sh
```

### Force Reload:
1. Shake device → Reload
2. Or close Expo Go completely and reconnect

## 📊 Connection Modes Explained

| Mode | Command | Best For | Reliability |
|------|---------|----------|-------------|
| **Tunnel** | `npm run dev` | Physical devices | ⭐⭐⭐⭐ |
| **LAN** | `npm run dev:lan` | Same WiFi, fast | ⭐⭐⭐ |
| **Simulator** | `npm run dev` + 'i' | Development | ⭐⭐⭐⭐⭐ |

## 🎯 Bottom Line

**The fix:** Your default `dev` script now uses tunnel mode.

**To see changes:**
- Physical device: Make edit → Save → Shake → Reload
- Simulator: Make edit → Save → Auto-reloads

**Remember:** Expo Go on physical devices will always require manual reloads. This is expected behavior, not a bug.





