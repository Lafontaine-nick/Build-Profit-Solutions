# QR Code Instructions

## Current Status

Expo is running in tunnel mode, but the QR code may not be visible in the background terminal.

## How to Get the QR Code

### Option 1: Check Your Terminal Window
Look at the terminal window where you normally run `npm run dev`. The QR code should appear there after Metro finishes bundling (usually 30-60 seconds).

### Option 2: Restart Expo in Foreground
Stop the current Expo process and run it in a visible terminal:

```bash
# Stop background Expo
pkill -f "expo start"

# Start in foreground (you'll see the QR code)
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npx expo start --tunnel --clear
```

### Option 3: Get Connection URL
The tunnel URL should be something like:
- `exp://exp.host/@your-username/your-project`
- Or check the terminal for "Metro waiting on exp://..."

## What to Do Once You Have the QR Code

1. **In Expo Go:**
   - Close the app completely (swipe up, remove from app switcher)
   - Reopen Expo Go
   - Tap "Scan QR Code"
   - Scan the new QR code
   - Wait for app to load

2. **Test the Edits:**
   - Navigate to Bid Summary page
   - Look for "Total Bid [TEST EDIT]" at the top
   - Look for "Bid Summary [SIMPLE TEST]" in the title

## If QR Code Still Doesn't Appear

Try starting Expo without tunnel mode (faster, but requires same WiFi):

```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npx expo start --clear
```

Then look for the QR code or connection URL in the terminal.





