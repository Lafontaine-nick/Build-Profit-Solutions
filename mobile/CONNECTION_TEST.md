# 🔌 Connection Test - Critical Checks

## The Problem
- ❌ No automatic hot reload
- ❌ Shake → Reload doesn't work
- ❌ No errors shown

**This suggests the app is NOT properly connected to Metro.**

## Critical Tests

### Test 1: Can Your Phone Reach Metro?

**From your iPhone's Safari browser, try:**
```
http://192.168.0.201:8081
```

**Expected:** You should see the Metro bundler web interface
**If it fails:** Network/firewall issue - Metro not accessible from phone

### Test 2: Check Expo Go Connection Status

**In Expo Go:**
1. Shake device
2. Tap "Settings" or "Connection"
3. Check if it shows:
   - ✅ "Connected" to Metro
   - ❌ "Disconnected" or connection error

### Test 3: Verify You're Connected to the Right Project

**In Expo Go:**
1. Shake device
2. Check the connection URL
3. Should show: `exp://192.168.0.201:8081` (or similar)
4. If it shows a different URL, you're connected to wrong Metro instance

### Test 4: Force Reconnection

**Try this:**
1. **Close Expo Go completely** (swipe up, force quit)
2. **In terminal, restart Expo:**
   ```bash
   cd mobile
   pkill -f "expo start"
   npx expo start --lan
   ```
3. **Wait for QR code**
4. **Reopen Expo Go**
5. **Scan NEW QR code**
6. **Wait for app to fully load**
7. **Test emoji change again**

### Test 5: Check Firewall

**On your Mac:**
```bash
# Check if firewall is blocking
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
```

**If firewall is on, you may need to allow Node.js**

## Most Likely Issue

**The app is using a cached bundle and not connected to the current Metro instance.**

**Solution:**
1. Force quit Expo Go
2. Restart Expo (fresh QR code)
3. Reconnect with new QR code
4. Test again

## If All Tests Pass But Still Doesn't Work

**This confirms Expo Go limitation. Use iOS Simulator:**
```bash
cd mobile
npx expo start
# Press 'i' for iOS Simulator
```














