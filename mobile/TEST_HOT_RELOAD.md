# Test Hot Reload - Diagnostic Steps

## Step 1: Check Metro Terminal

**Look at the terminal where `npm run dev` is running.**

When you save a file, you should see:
- `Bundling...` message
- File path being processed
- `Bundled` message

**If you DON'T see "Bundling..." when you save, file watching is broken.**

## Step 2: Test with Simple Change

Make this simple test change in TeamTab.tsx:

```tsx
// Find the "Team Details" text and temporarily change it to:
<Text style={styles.teamHeaderTitle}>Team Details TEST</Text>
```

Save the file and watch:
1. Metro terminal - does it show "Bundling..."?
2. Your device - does "TEST" appear?

## Step 3: Check Expo Go Connection

In Expo Go on your device:
1. Shake device
2. Check "Connection" - should show "Connected"
3. Check "Fast Refresh" - should be ON

## Step 4: Check for Errors

Look for red errors in:
- Metro terminal
- Expo Go on device
- Browser console (if using web)

## Step 5: Verify File Watching

Run this command while Metro is running:
```bash
touch mobile/components/TeamTab.tsx
```

Watch Metro terminal - it should immediately show activity.

## Most Likely Causes

1. **TypeScript errors blocking Fast Refresh** - Fix errors
2. **File watching not working** - Metro not detecting saves
3. **Expo Go not connected** - Network/connection issue
4. **Fast Refresh disabled** - Check Expo Go settings

## Quick Fix to Try

1. Stop Metro (Ctrl+C)
2. Clear cache: `rm -rf .expo node_modules/.cache`
3. Restart: `npm run dev`
4. Reconnect device (scan QR code)
5. Test with simple change














