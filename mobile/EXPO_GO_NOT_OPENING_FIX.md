# 🔧 Expo Go Not Opening - Complete Fix Guide

## Common Issues & Solutions

### Issue 1: QR Code Not Scanning
**Symptoms:** QR code doesn't work when scanned

**Solutions:**
1. **Make sure you're using the LATEST QR code** - Old QR codes expire
2. **Try typing the URL manually** in Expo Go:
   - Open Expo Go
   - Tap "Enter URL manually"
   - Type the `exp://...` URL from terminal
3. **Check if tunnel is established** - Look for "Tunnel ready" in terminal

### Issue 2: "Connection Timeout" Error
**Symptoms:** App tries to connect but times out

**Solutions:**
1. **Use LAN mode instead of tunnel:**
   ```bash
   cd mobile
   pkill -f "expo start"
   npx expo start --lan --clear
   ```
   - Make sure phone and computer are on same WiFi
   - Check your computer's IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`

2. **Check firewall settings:**
   - Allow port 8081 (Metro bundler)
   - Allow port 19000 (Expo dev server)

### Issue 3: App Crashes Immediately
**Symptoms:** App opens then crashes right away

**Solutions:**
1. **Clear Expo Go cache:**
   - In Expo Go: Shake device → Settings → Clear cache
   - Or: Delete and reinstall Expo Go app

2. **Check for JavaScript errors:**
   - Look at terminal for error messages
   - Check for syntax errors in your code

### Issue 4: "Unable to Connect" Error
**Symptoms:** Expo Go can't reach Metro bundler

**Solutions:**
1. **Verify Metro is running:**
   ```bash
   lsof -i :8081
   ```
   Should show a node process. If not, restart Expo.

2. **Try different connection mode:**
   ```bash
   # Try tunnel
   npx expo start --tunnel --clear
   
   # Or try LAN
   npx expo start --lan --clear
   ```

### Issue 5: QR Code Shows But Nothing Happens
**Symptoms:** QR code scans but app doesn't load

**Solutions:**
1. **Force close Expo Go completely:**
   - Swipe up on Expo Go in app switcher
   - Fully close it
   - Reopen and scan again

2. **Check terminal for errors:**
   - Look for red error messages
   - Check if Metro is bundling

3. **Try manual URL entry:**
   - Copy the `exp://...` URL from terminal
   - In Expo Go: Tap "Enter URL manually"
   - Paste the URL

## 🚀 Step-by-Step Fix Process

### Step 1: Complete Reset
```bash
cd /Users/nicholas/Documents/Build-Profit-Solutions/mobile

# Kill everything
pkill -f "expo start"
pkill -f "metro"
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

# Clear caches
rm -rf .expo .expo-shared node_modules/.cache

# Wait
sleep 2
```

### Step 2: Start Fresh with LAN Mode
```bash
# Start with LAN mode (faster, more reliable if same WiFi)
npx expo start --lan --clear
```

**OR** if LAN doesn't work:

```bash
# Start with tunnel mode (works across networks)
npx expo start --tunnel --clear
```

### Step 3: In Expo Go App
1. **Force close Expo Go** completely
2. **Reopen Expo Go**
3. **Scan the NEW QR code** from terminal
4. **Wait 30-60 seconds** for connection

### Step 4: If Still Not Working
Try iOS Simulator (most reliable):
```bash
cd mobile
npx expo start --clear
# Press 'i' when prompted
```

## 🔍 Diagnostic Commands

### Check if Expo is running:
```bash
lsof -i :8081
```

### Check your network IP:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### Check for errors in terminal:
Look for:
- Red error messages
- "Failed to connect" messages
- Network errors

## 💡 Best Practices

### For Physical Devices:
1. **Always use tunnel mode** if on different networks
2. **Use LAN mode** if on same WiFi (faster)
3. **Always scan a fresh QR code** after restarting Expo
4. **Force close Expo Go** before scanning new QR code

### For Development:
1. **Use iOS Simulator** for most reliable experience
2. **Use Android Emulator** if on Windows/Linux
3. **Physical devices** are best for final testing

## 🎯 Quick Fix Script

I've created a script that does all of this automatically:

```bash
cd /Users/nicholas/Documents/Build-Profit-Solutions/mobile
./fix-expo-not-opening.sh
```

## 📱 Alternative: Use Development Build

If Expo Go keeps having issues, create a development build:

```bash
cd mobile
npx expo run:ios
# or
npx expo run:android
```

This creates a custom app with your code built in - no Expo Go needed!

## 🚨 Still Not Working?

1. **Check Expo Go version** - Update to latest version
2. **Check phone OS** - Make sure it's compatible
3. **Try different device** - Test on another phone
4. **Check network** - Try different WiFi network
5. **Use simulator** - Most reliable option
