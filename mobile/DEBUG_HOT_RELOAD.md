# 🐛 Debug Hot Reload - It Worked Before!

## The Problem
- ❌ Hot reload doesn't work (automatic or manual)
- ✅ **This worked a few days ago** - something changed!

## Critical Checks

### 1. Check Metro Terminal Output
**Look at the terminal where Expo is running:**
- When you save a file, do you see "Bundling..."?
- Are there any error messages?
- Does Metro show any activity when files change?

### 2. Check if Metro is Watching Files
**Test this:**
```bash
cd mobile
touch components/TeamTab.tsx
# Watch Metro terminal - should show activity immediately
```

### 3. Check for Code Issues That Break Fast Refresh

**Fast Refresh breaks with:**
- Anonymous default exports: `export default () => ...` ❌
- HOCs without proper names
- Class components with certain patterns
- Files with syntax errors that prevent parsing

**Your component looks fine:**
- ✅ `export default function TeamTab()` - named export
- ✅ Proper React component structure

### 4. Check Metro Cache
**Try this:**
```bash
cd mobile
rm -rf .expo node_modules/.cache .metro
npx expo start --lan
```

### 5. Check if File Changes Are Actually Saved
**Verify in Cursor:**
- When you save, does the file indicator show "saved"?
- Check file timestamp: `stat components/TeamTab.tsx`
- Is Cursor actually writing to disk?

### 6. Check Expo Go Connection
**In Expo Go:**
- Shake device → Settings
- Is "Fast Refresh" enabled?
- What does connection status show?
- Try disconnecting and reconnecting

### 7. Check for Recent Changes
**What changed since it worked?**
- Did you update any packages?
- Did you change Metro config?
- Did you change Babel config?
- Did you add any new dependencies?

## Most Likely Causes (Since It Worked Before)

1. **Metro cache corruption** - Clear all caches
2. **File watching broken** - Restart Metro
3. **Expo Go cache** - Force quit and reconnect
4. **Recent code change** - Something broke Fast Refresh
5. **Package update** - Expo or Metro version changed

## Quick Fix to Try

```bash
cd mobile

# Nuclear option - clear everything
rm -rf .expo node_modules/.cache .metro
pkill -f "expo start"
pkill -f "metro"

# Restart fresh
npx expo start --lan
```

Then:
1. Force quit Expo Go
2. Reconnect with new QR code
3. Test emoji change

## If Still Doesn't Work

**Check Metro logs for errors:**
- Look for any red error messages
- Check if Metro is actually bundling
- Verify file watching is working

**Test with a simpler component:**
- Create a test file to see if Fast Refresh works at all
- This will tell us if it's specific to TeamTab.tsx or global

---

*Since it worked before, this is likely a cache or configuration issue, not an Expo Go limitation.*














