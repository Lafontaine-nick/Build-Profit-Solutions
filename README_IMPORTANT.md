# ⚠️ IMPORTANT - Read This Before Editing!

## 🎯 Your App is Working - Keep It That Way!

**Last Working State**: October 1, 2025

---

## ✅ Current Status

```
✅ Backend:  Running on port 3001
✅ Mobile:   Running on port 8081
✅ estimate-generator.jsx - Working (75KB, 1,920 lines)
✅ All packages installed
✅ No route conflicts
✅ Caches cleared
```

---

## 🚨 CRITICAL: Do These Things to Avoid Breaking the App

### ❌ **NEVER DO THIS:**
1. **NEVER** copy/paste code from browser dev tools or documentation sites
   - They add HTML markup like `<pre>`, `&nbsp;`, `</pre>`
   - This BREAKS your code!

2. **NEVER** create duplicate route files
   - Don't have both `filename.tsx` AND `filename.jsx`
   - Choose ONE extension per file

3. **NEVER** skip clearing cache if changes don't appear
   - Run: `npx expo start -c`

### ✅ **ALWAYS DO THIS:**
1. **ALWAYS** copy code from your editor (Cursor/VS Code)
2. **ALWAYS** check for duplicates: `ls mobile/app/(tabs)/*.{tsx,jsx}`
3. **ALWAYS** clear cache when something seems wrong

---

## 🔧 Quick Commands You'll Need

### Run Health Check (Recommended Daily):
```bash
./check-app-health.sh
```

### Start Development:
```bash
# Terminal 1
cd backend && npm start

# Terminal 2  
cd mobile && npx expo start
```

### Clear Cache (If things break):
```bash
killall -9 node
cd mobile && npx expo start -c
```

### Full Reset (Nuclear option):
```bash
killall -9 node
cd mobile
rm -rf .expo .expo-shared node_modules/.cache
watchman watch-del-all
npx expo start -c
```

---

## 📋 What Broke Today (So You Don't Repeat It)

### The Problem:
1. `estimate-generator.tsx` got corrupted with HTML markup
   - Someone copied code from a browser/documentation viewer
   - File had `<pre>`, `&nbsp;`, `</pre>` tags mixed in

2. Duplicate files caused route conflicts
   - Had both `.tsx` AND `.jsx` versions
   - Expo Router couldn't decide which to use

3. Metro bundler cached the bad code
   - Even after fixing files, old code was served
   - Needed full cache clear

### The Solution:
1. ✅ Deleted corrupted `.tsx` file
2. ✅ Kept working `.jsx` file  
3. ✅ Cleared ALL caches
4. ✅ Installed missing packages

---

## 🛟 Emergency Recovery

### If App Won't Load:
```bash
# Step 1: Check what changed
git status
git diff

# Step 2: Kill everything
killall -9 node

# Step 3: Clear cache
cd mobile
rm -rf .expo .expo-shared
npx expo start -c

# Step 4: If still broken, restore from git
git checkout HEAD -- path/to/broken/file
```

### If You See Red Error Screen:
1. **Read the error** - It usually tells you what's wrong
2. **Check for HTML** - `grep -r "&nbsp;" mobile/app/`
3. **Check for duplicates** - `ls mobile/app/(tabs)/*.{tsx,jsx}`
4. **Clear cache** - `npx expo start -c`

---

## 📚 Full Documentation

- **Troubleshooting Guide**: `./APP_TROUBLESHOOTING_GUIDE.md`
- **Deployment Guide**: `./DEPLOYMENT_STATUS.md`
- **Quick Start**: `./QUICK_START.md`

---

## 🎯 Before You Start Coding

**Run this checklist**:
- [ ] Run health check: `./check-app-health.sh`
- [ ] Pull latest: `git pull`
- [ ] Check git status: `git status`
- [ ] Servers stopped: `killall -9 node`

**While You Code**:
- [ ] Copy from editor ONLY (not browser)
- [ ] Keep one version per file (.tsx OR .jsx)
- [ ] Test changes incrementally
- [ ] Clear cache if changes don't appear

**After You Code**:
- [ ] Run health check again
- [ ] Commit working code
- [ ] Clear cache before closing

---

## 🏆 Success Checklist

Your app is healthy when you see:
- ✅ `./check-app-health.sh` shows all green
- ✅ No TypeScript errors: `cd mobile && npx tsc --noEmit`
- ✅ App loads without red screens
- ✅ No "route conflict" errors

---

## 💡 Pro Tips

1. **Commit often** - Small commits = easy to undo
2. **Use branches** - Test risky changes in a branch
3. **Run health check** - Before and after editing
4. **Clear cache liberally** - It's quick and fixes 90% of issues
5. **When in doubt** - Ask before copying from web

---

**Remember**: The app works NOW. Keep it simple, follow the rules above, and it will keep working! 🚀

---

*Last verified working: October 1, 2025*  
*estimate-generator.jsx: 75KB, 1,920 lines - DO NOT DELETE* 