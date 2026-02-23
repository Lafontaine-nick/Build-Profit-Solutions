# 🔧 Expo Go Timeout Fix

## The Problem
Expo Go is timing out when trying to connect. This is **NOT** a backend issue - it's a Metro bundler connection issue.

## Understanding the Difference

- **Backend (ports 3001/3000)**: Your API server - ✅ Running
- **Metro Bundler (port 8081)**: Serves your React Native app to Expo Go - ❌ Not running or wrong connection

## Why Timeout Happens

Expo Go needs to connect to **Metro bundler on port 8081**, not the backend. The timeout means:
1. Metro bundler isn't running, OR
2. Metro bundler is running but Expo Go can't reach it (wrong IP/network issue)

## ✅ Quick Fix

### Step 1: Stop Everything and Restart Metro
```bash
cd /Users/nicholas/Documents/Build-Profit-Solutions/mobile

# Kill all Expo/Metro processes
pkill -f "expo start"
pkill -f "metro"
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

# Clear caches
rm -rf .expo .expo-shared node_modules/.cache

# Start fresh with LAN mode
npx expo start --lan --clear
```

### Step 2: Connect in Expo Go

**Option A: Manual URL Entry (Most Reliable)**
1. Open Expo Go
2. Tap "Enter URL manually" or "Enter address manually"
3. Type: `exp://10.71.3.126:8081`
4. Tap Connect

**Option B: Scan QR Code**
- Wait for QR code in terminal
- Scan with Expo Go

### Step 3: If Still Timing Out

**Try Tunnel Mode:**
```bash
cd mobile
npx expo start --tunnel --clear
```
This creates a public URL that works across networks.

## 🔍 Diagnostic Steps

### Check if Metro is Running:
```bash
lsof -i :8081
```
Should show a node process. If not, Metro isn't running.

### Test Connection from Phone:
In your phone's browser, go to:
```
http://10.71.3.126:8081
```

- ✅ If you see Metro status page → Network is fine, issue is with Expo Go
- ❌ If connection fails → Firewall or network issue

### Check What Expo Go is Trying to Connect To:
1. In Expo Go, shake device
2. Check connection URL
3. Should show: `exp://10.71.3.126:8081`
4. If it shows different IP → That's the problem!

## 🚨 Common Issues

### Issue 1: Metro Not Running
**Symptom:** Timeout immediately
**Fix:** Start Metro with `npx expo start --lan --clear`

### Issue 2: Wrong IP Address
**Symptom:** Expo Go tries to connect to old IP
**Fix:** 
- Restart Expo to get fresh IP
- Or manually enter: `exp://10.71.3.126:8081`

### Issue 3: Firewall Blocking
**Symptom:** Phone can't reach `http://10.71.3.126:8081`
**Fix:** 
- System Settings → Network → Firewall
- Allow Node.js

### Issue 4: Expo Go Cache
**Symptom:** Keeps trying old connection
**Fix:**
- Force close Expo Go completely
- Reopen and connect fresh

## 💡 Best Solution

**Use the fix script:**
```bash
cd /Users/nicholas/Documents/Build-Profit-Solutions/mobile
./fix-expo-timeout.sh
```

This will:
1. Check if Metro is running
2. Kill old processes
3. Clear caches
4. Start Metro with correct IP
5. Show you the exact URL to use

## 🎯 Quick Test

**After starting Metro, verify:**
1. Terminal shows: `Metro waiting on exp://10.71.3.126:8081`
2. QR code appears in terminal
3. In Expo Go: Manually enter `exp://10.71.3.126:8081`

If this works, the issue was Metro not running or wrong connection URL.

## 📝 Summary

**Backend is running ✅** (ports 3001/3000)
**Metro needs to be running ✅** (port 8081)
**Expo Go connects to Metro, not backend**

The timeout is because Expo Go can't reach Metro bundler on port 8081. Start Metro with the correct IP and connect manually in Expo Go.
