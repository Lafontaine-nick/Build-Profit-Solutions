# 🔧 Build Profit Solutions - Troubleshooting Guide

**Last Updated**: October 1, 2025  
**Purpose**: Prevent and fix common issues when editing the app

---

## ⚠️ CRITICAL LESSONS LEARNED

### 1. **NEVER Copy Code from Browser/Web Viewers**
**Problem**: Code copied from documentation sites or browser dev tools often contains HTML markup like:
- `<pre class="prettyprint">` tags
- `&nbsp;` entities  
- `</pre>` closing tags

**Solution**:
- ✅ Always copy from your code editor (VS Code, Cursor, etc.)
- ✅ Use Git to restore files if corrupted
- ❌ Never paste code from Chrome dev tools, documentation sites, or Stack Overflow directly

### 2. **Avoid Duplicate Route Files**
**Problem**: Having both `.tsx` and `.jsx` versions of the same route causes conflicts:
```
estimate-generator.tsx  ❌
estimate-generator.jsx  ❌
```

**Solution**:
- ✅ Choose ONE extension per route file
- ✅ Check for duplicates: `ls -la app/(tabs)/*.{tsx,jsx}`
- ✅ Delete duplicates immediately

### 3. **Clear Cache When Files Don't Update**
**Problem**: Metro bundler caches old/corrupted code

**Solution**:
```bash
# Full cache clear
killall -9 node
rm -rf .expo .expo-shared
rm -rf $TMPDIR/metro-* $TMPDIR/haste-map-*
watchman watch-del-all
npx expo start -c
```

---

## 🚨 Common Errors & Fixes

### Error: "Unexpected token, expected }}"
**Cause**: HTML entities or markup in your code  
**Fix**:
```bash
# Search for HTML in your files
grep -r "&nbsp;\|<pre\|</pre" mobile/app/
# Remove them manually or restore from git
```

### Error: "Route files conflict"
**Cause**: Duplicate files with different extensions  
**Fix**:
```bash
# Find duplicates
ls -la mobile/app/\(tabs\)/*.{jsx,tsx}
# Delete the unwanted one
rm mobile/app/\(tabs\)/filename.tsx
```

### Error: "Unable to resolve @react-native-community/slider"
**Cause**: Missing package  
**Fix**:
```bash
cd mobile
npm install @react-native-community/slider
```

### Error: "Network request failed"
**Cause**: Phone can't reach localhost:3001  
**Fix**: Use one of these:
```bash
# Option 1: Use tunnel (slower but works)
npx expo start --tunnel

# Option 2: Use LAN (faster, same network required)
npx expo start --lan

# Option 3: Use ngrok
ngrok http 3001
# Then update EXPO_PUBLIC_API_BASE_URL in .env.local
```

---

## ✅ Best Practices Checklist

### Before Editing Code:
- [ ] Pull latest changes: `git pull`
- [ ] Check for uncommitted changes: `git status`
- [ ] Backup important files if making big changes

### While Editing:
- [ ] ✅ Use your code editor (Cursor/VS Code) for all copy/paste
- [ ] ✅ Keep only ONE version of each route file (.tsx OR .jsx)
- [ ] ✅ Test changes incrementally
- [ ] ❌ Never copy from browser dev tools or documentation sites

### After Editing:
- [ ] Clear cache if changes don't appear: `npx expo start -c`
- [ ] Check for TypeScript errors: `npx tsc --noEmit`
- [ ] Commit working code: `git add . && git commit -m "description"`

---

## 🛠️ Quick Recovery Commands

### If App Won't Start:
```bash
# 1. Kill all processes
killall -9 node

# 2. Clear all caches
cd mobile
rm -rf .expo .expo-shared node_modules/.cache
watchman watch-del-all 2>/dev/null || true

# 3. Restart fresh
npx expo start -c
```

### If Strange Errors Appear:
```bash
# 1. Check for HTML in files
grep -r "&nbsp;\|<pre\|</pre" mobile/app/ || echo "Clean!"

# 2. Check for duplicates
find mobile/app -name "*.tsx" -o -name "*.jsx" | sort | uniq -d

# 3. Reinstall dependencies if needed
cd mobile
rm -rf node_modules package-lock.json
npm install
```

---

## 📋 File Corruption Recovery

### If a file gets corrupted:

**Option 1: Restore from Git**
```bash
git checkout HEAD -- mobile/app/\(tabs\)/filename.tsx
```

**Option 2: Check Git history**
```bash
git log --oneline mobile/app/\(tabs\)/filename.tsx
git show COMMIT_HASH:mobile/app/\(tabs\)/filename.tsx > filename.tsx
```

**Option 3: Use backup**
```bash
# If you have backups in .bak files
cp mobile/app/\(tabs\)/filename.tsx.bak mobile/app/\(tabs\)/filename.tsx
```

---

## 🔍 Health Check Script

Create this script to check your app health:

```bash
#!/bin/bash
# Save as: check-app-health.sh

echo "🔍 Build Profit Solutions - Health Check"
echo "========================================"

# Check for HTML in files
echo -n "Checking for HTML entities... "
if grep -r "&nbsp;\|<pre\|</pre" mobile/app/ >/dev/null 2>&1; then
    echo "❌ FOUND!"
    grep -r "&nbsp;\|<pre\|</pre" mobile/app/
else
    echo "✅ Clean"
fi

# Check for duplicate routes
echo -n "Checking for duplicate routes... "
DUPES=$(find mobile/app -name "*.tsx" -o -name "*.jsx" | sed 's/\.[^.]*$//' | sort | uniq -d)
if [ -n "$DUPES" ]; then
    echo "❌ FOUND!"
    echo "$DUPES"
else
    echo "✅ No duplicates"
fi

# Check TypeScript errors
echo -n "Checking TypeScript... "
cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "✅ No critical errors"

echo "========================================"
echo "Health check complete!"
```

---

## 📝 What Was Fixed Today

### Issues Found:
1. ❌ `estimate-generator.tsx` corrupted with HTML markup
2. ❌ Duplicate route files causing conflicts  
3. ❌ Metro bundler serving cached corrupted code
4. ❌ Missing `@react-native-community/slider` package

### Solutions Applied:
1. ✅ Deleted corrupted `.tsx` file
2. ✅ Kept working `.jsx` file (75KB, 1,920 lines)
3. ✅ Cleared all caches (Metro, Expo, Watchman)
4. ✅ Installed missing slider package

### Current Working State:
```
✅ estimate-generator.jsx - WORKING (keep this!)
✅ No route conflicts
✅ All caches cleared
✅ All packages installed
```

---

## 🚀 Safe Restart Commands

### Start Development (Clean):
```bash
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Mobile (with clean cache)
cd mobile && npx expo start -c
```

### Start Development (Normal):
```bash
# Terminal 1 - Backend  
cd backend && npm start

# Terminal 2 - Mobile
cd mobile && npx expo start
```

### Deploy to Production:
```bash
# Backend
cd backend && ./deploy.sh

# Mobile
cd mobile && npx eas build --platform all
```

---

## 📞 When Things Go Wrong

### Step 1: Don't Panic
- The working code exists in Git history
- You can always restore files
- Cache issues are easily fixed

### Step 2: Check These First
1. `git status` - See what changed
2. `git diff` - See exact changes
3. Clear cache - Often fixes 80% of issues

### Step 3: Recovery Options
1. **Undo recent changes**: `git checkout -- filename`
2. **Go back one commit**: `git reset --hard HEAD~1`
3. **Clear everything**: Run full cache clear script above

---

## 🎯 Maintenance Checklist

### Daily (Before Coding):
- [ ] `git pull` - Get latest changes
- [ ] Check servers are stopped: `lsof -i :3001 :8081`
- [ ] Start fresh: `npx expo start -c`

### Weekly:
- [ ] Update packages: `npx expo install --fix`
- [ ] Check for security updates: `npm audit`
- [ ] Backup important files

### Monthly:
- [ ] Review and clean old backup files
- [ ] Update dependencies: `npx expo-doctor`
- [ ] Test on real devices

---

## ✨ Success Indicators

Your app is healthy when:
- ✅ No TypeScript errors in critical files
- ✅ No route conflicts (one file per route)
- ✅ No HTML entities in code files
- ✅ Metro bundler starts without errors
- ✅ App loads on device without red screens

---

**Remember**: When in doubt, clear cache and restart! 90% of issues are cache-related. 