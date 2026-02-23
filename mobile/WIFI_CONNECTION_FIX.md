# 🔧 WiFi Connection Fix - Both Devices on Same Network

## The Problem
Your phone and laptop are on the same WiFi, but Expo Go still won't connect.

## Common Causes & Fixes

### Issue 1: Wrong IP Address
**Problem:** Expo might be using an old or incorrect IP address.

**Fix:**
1. **Find your current IP:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Look for something like `192.168.1.xxx` or `10.0.0.xxx`

2. **Restart Expo with LAN mode:**
   ```bash
   cd mobile
   pkill -f "expo start"
   npx expo start --lan --clear
   ```

3. **Check the QR code/URL** - Should show your current IP

### Issue 2: Firewall Blocking Port 8081
**Problem:** macOS firewall is blocking the connection.

**Fix:**
1. **System Settings → Network → Firewall**
2. **Click "Options" or "Firewall Options"**
3. **Make sure Node.js is allowed** (or temporarily disable firewall to test)

**Or via Terminal:**
```bash
# Check firewall status
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Allow Node.js (if needed)
# System Settings → Network → Firewall → Options → Add Node.js
```

### Issue 3: Using Tunnel Mode Instead of LAN
**Problem:** Expo is running in tunnel mode when it should use LAN.

**Fix:**
```bash
cd mobile
pkill -f "expo start"
npx expo start --lan --clear
```

**Look for:** `Metro waiting on exp://192.168.x.x:8081` (your local IP)
**NOT:** `exp://...exp.direct...` (that's tunnel mode)

### Issue 4: Expo Go Cache
**Problem:** Expo Go is using a cached/old connection.

**Fix:**
1. **Force close Expo Go completely:**
   - Swipe up on Expo Go in app switcher
   - Make sure it's fully closed

2. **Clear Expo Go cache:**
   - In Expo Go: Shake device → Settings → Clear cache
   - Or: Delete and reinstall Expo Go

3. **Reconnect:**
   - Open Expo Go fresh
   - Scan NEW QR code from terminal
   - Or manually enter: `exp://YOUR_IP:8081`

### Issue 5: Metro Not Actually Running
**Problem:** Expo process died or isn't running.

**Fix:**
```bash
# Check if running
lsof -i :8081

# If nothing shows, restart:
cd mobile
npx expo start --lan --clear
```

## 🔍 Step-by-Step Diagnostic

### Step 1: Run Diagnostic Script
```bash
cd mobile
./diagnose-wifi-connection.sh
```

This will show:
- ✅ If Metro is running
- ✅ Your computer's IP address
- ✅ Firewall status
- ✅ How to test connection

### Step 2: Test Connection from Phone
**In your phone's browser (Safari/Chrome):**
```
http://YOUR_COMPUTER_IP:8081
```

**Expected:** You should see Metro bundler status page
**If fails:** Firewall or network issue

### Step 3: Manual Connection in Expo Go
1. **Open Expo Go**
2. **Tap "Enter URL manually"** (or similar option)
3. **Type:** `exp://YOUR_COMPUTER_IP:8081`
   - Replace `YOUR_COMPUTER_IP` with the IP from Step 1
   - Example: `exp://192.168.1.100:8081`

### Step 4: Verify Same Network
**On your phone:**
- Settings → WiFi
- Check the network name
- Should match your laptop's WiFi network

**On your laptop:**
- System Settings → Network → WiFi
- Check network name matches

## ✅ Complete Fix Process

```bash
# 1. Stop everything
cd /Users/nicholas/Documents/Build-Profit-Solutions/mobile
pkill -f "expo start"
pkill -f "metro"
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

# 2. Clear caches
rm -rf .expo .expo-shared node_modules/.cache

# 3. Find your IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# 4. Start with LAN mode
npx expo start --lan --clear
```

**Then:**
1. Wait for QR code to appear
2. Note the IP address in the URL (should match your computer's IP)
3. In Expo Go: Force close → Reopen → Scan QR code
4. Or manually enter: `exp://YOUR_IP:8081`

## 🚨 If Still Not Working

### Option 1: Check Firewall
```bash
# Temporarily disable firewall to test
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off

# Test connection
# Then re-enable:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
```

### Option 2: Use Tunnel Mode
Even though you're on same WiFi, tunnel might work better:
```bash
cd mobile
npx expo start --tunnel --clear
```

### Option 3: Use iOS Simulator
Most reliable option:
```bash
cd mobile
npx expo start --clear
# Press 'i' for iOS Simulator
```

## 💡 Quick Test

**Test if your phone can reach your computer:**
1. Find your computer's IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
2. On your phone's browser, go to: `http://YOUR_IP:8081`
3. If you see Metro status page → Network is fine, issue is with Expo Go
4. If connection fails → Firewall or network configuration issue

## 🎯 Most Likely Fix

**90% of the time, it's one of these:**
1. ✅ **Firewall blocking** → Allow Node.js in firewall settings
2. ✅ **Wrong IP address** → Restart Expo with `--lan` flag
3. ✅ **Expo Go cache** → Force close and reconnect
4. ✅ **Not using LAN mode** → Make sure you see `--lan` in the command

**Try this first:**
```bash
cd mobile
pkill -f "expo start"
npx expo start --lan --clear
```

Then scan the QR code or manually enter the URL shown in terminal!
