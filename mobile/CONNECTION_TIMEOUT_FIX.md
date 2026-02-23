# 🔧 Connection Timeout Fix

## The Problem
Your app is showing: **"The request timed out"** when trying to connect to `exp://10.71.3.126:8081`

## Why This Happens
1. **Network mismatch**: Your device and computer might be on different networks
2. **IP address changed**: Your computer's IP might have changed
3. **Firewall blocking**: Your firewall might be blocking port 8081
4. **Metro not reachable**: The Metro bundler isn't accessible from your device

## ✅ Quick Fix (Recommended)

### Option 1: Use Tunnel Mode (Best for Physical Devices)
```bash
cd /Users/nicholas/Documents/Build-Profit-Solutions/mobile
./fix-connection-timeout.sh
```

Or manually:
```bash
cd mobile
pkill -f "expo start"
lsof -ti:8081 | xargs kill -9 2>/dev/null || true
npx expo start --tunnel --clear
```

**Why tunnel mode works:**
- ✅ Creates a public URL that works across networks
- ✅ Bypasses local network issues
- ✅ More reliable for physical devices
- ⚠️ Takes 30-60 seconds to establish connection

### Option 2: Use iOS Simulator (Most Reliable)
```bash
cd mobile
npx expo start --clear
# Then press 'i' to open iOS Simulator
```

**Why simulator works:**
- ✅ Uses localhost (no network issues)
- ✅ Instant connection
- ✅ Most reliable for development

### Option 3: Fix Network IP (If Same WiFi)
If your device and computer are on the same WiFi:

1. **Find your computer's IP:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. **Start Expo with LAN mode:**
   ```bash
   cd mobile
   npx expo start --lan --clear
   ```

3. **Make sure both devices are on the same WiFi network**

## 📱 What to Do in Expo Go

After restarting Expo:

1. **In Expo Go app**: Tap "Go Home" button (to clear the old connection)
2. **Wait for new QR code** in terminal (look for `exp://...exp.direct/...`)
3. **Scan the NEW QR code** with Expo Go
4. **Wait 30-60 seconds** for tunnel to establish (if using tunnel mode)
5. **App should load!**

## 🔍 Verify It's Working

After scanning QR code, you should see:
- ✅ "Building JavaScript bundle..." in terminal
- ✅ App starts loading in Expo Go
- ✅ No timeout errors

## 🚨 If Still Not Working

### Check 1: Is Metro Running?
```bash
lsof -i :8081
```
Should show a node process. If not, restart Expo.

### Check 2: Can Device Reach Computer?
Try accessing from your phone's browser:
- Tunnel mode: Not applicable (uses Expo's servers)
- LAN mode: `http://YOUR_COMPUTER_IP:8081` (should show Metro status page)

### Check 3: Firewall Settings
Make sure your firewall allows:
- Port 8081 (Metro bundler)
- Port 19000 (Expo dev server)

### Check 4: Network Connection
- Ensure both devices are on the same WiFi (for LAN mode)
- Or use tunnel mode (works across networks)

## 💡 Prevention

**Always use tunnel mode for physical devices:**
```bash
cd mobile
npx expo start --tunnel
```

**Or use iOS Simulator for development:**
```bash
cd mobile
npx expo start
# Press 'i' for iOS Simulator
```

## 🎯 Bottom Line

**The timeout happens because your device can't reach the Metro bundler.**

**Solution:**
1. Use tunnel mode (works across networks) ✅
2. Or use iOS Simulator (most reliable) ✅
3. Or ensure same WiFi + correct IP for LAN mode ✅

**After fixing, always scan a fresh QR code in Expo Go!**
