# 📱 iOS Simulator Guide - Using Expo with Simulator

## Why iOS Simulator?

**Perfect for hotel WiFi:**
- ✅ Uses localhost (no network needed)
- ✅ No WiFi issues
- ✅ No client isolation problems
- ✅ Most reliable for development
- ✅ Fast hot reload

## Quick Start

### Option 1: Use the Script (Easiest)
```bash
cd /Users/nicholas/Documents/Build-Profit-Solutions/mobile
./start-ios-simulator.sh
```

### Option 2: Manual Start
```bash
cd /Users/nicholas/Documents/Build-Profit-Solutions/mobile
npx expo start --clear
# Then press 'i' when you see the options
```

## Step-by-Step Instructions

### Step 1: Start Expo
```bash
cd /Users/nicholas/Documents/Build-Profit-Solutions/mobile
npx expo start --clear
```

### Step 2: Wait for Options
You'll see something like:
```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
│ i │ open iOS simulator
│ w │ open web

› Press r │ reload app
```

### Step 3: Press 'i'
Press the `i` key on your keyboard to open iOS Simulator.

### Step 4: Wait for Simulator
- iOS Simulator will open (may take 10-30 seconds first time)
- Your app will automatically load
- No QR code needed!

## Requirements

### 1. Xcode Must Be Installed
- Download from App Store (it's free, but large ~10GB)
- Or check if already installed: `xcode-select -p`

### 2. Xcode Command Line Tools
If you get errors, run:
```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

### 3. iOS Simulator
- Comes with Xcode automatically
- No separate installation needed

## Troubleshooting

### "xcode-select: error: no developer directory"
**Fix:**
```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

### "iOS Simulator not found"
**Fix:**
1. Open Xcode
2. Xcode → Settings → Platforms
3. Make sure iOS is installed
4. Or: Xcode → Open Developer Tool → Simulator

### Simulator Opens But App Doesn't Load
**Fix:**
1. In Expo terminal, press `r` to reload
2. Or shake simulator: Device → Shake (Cmd+Ctrl+Z)
3. Or: Expo terminal → `r` → Reload

### Simulator is Slow
**Fix:**
1. Close other apps
2. Use a smaller device (iPhone SE instead of iPad)
3. Reduce simulator quality in settings

## Simulator Controls

### Keyboard Shortcuts
- `Cmd + R` - Reload app
- `Cmd + K` - Toggle keyboard
- `Cmd + Ctrl + Z` - Shake device (dev menu)
- `Cmd + ,` - Simulator settings

### Device Menu
- Device → Shake - Open dev menu
- Device → Restart - Restart simulator
- Device → Erase All Content - Reset simulator

## Advantages Over Physical Device

| Feature | iOS Simulator | Physical Device |
|---------|--------------|-----------------|
| Network needed | ❌ No | ✅ Yes |
| Hotel WiFi issues | ❌ No | ✅ Yes |
| Hot reload speed | ⚡ Fast | 🐌 Slower |
| Setup time | ⚡ Instant | 🐌 QR code, etc |
| Reliability | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

## Common Workflow

### Daily Development:
```bash
# Terminal 1: Start Expo
cd mobile
npx expo start --clear
# Press 'i' for simulator

# Make changes to code
# Save file
# App auto-reloads in simulator! ✨
```

### If Simulator Crashes:
1. Close simulator
2. In Expo terminal, press `i` again
3. Simulator reopens with app

### To Stop:
- Press `Ctrl+C` in Expo terminal
- Or close simulator window

## Tips

1. **Keep Simulator Open**: Don't close it between sessions - just restart Expo
2. **Use Smaller Device**: iPhone SE is faster than iPad Pro
3. **Keyboard Shortcuts**: Learn Cmd+R for reload
4. **Dev Menu**: Shake (Cmd+Ctrl+Z) to access Expo dev menu

## Troubleshooting Commands

```bash
# Check if Xcode is installed
xcode-select -p

# Check simulator availability
xcrun simctl list devices

# Reset simulator if needed
xcrun simctl erase all

# Open simulator manually
open -a Simulator
```

## Summary

**Best for:**
- ✅ Development (fast, reliable)
- ✅ Hotel WiFi situations
- ✅ Testing without physical device
- ✅ Quick iterations

**Not ideal for:**
- ❌ Testing device-specific features (camera, GPS, etc.)
- ❌ Final device testing (always test on real device before release)

**For your situation (hotel WiFi):**
iOS Simulator is PERFECT - no network issues at all!
