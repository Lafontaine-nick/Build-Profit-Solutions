# Quick Reload Guide - When to Reload vs Reset

## ✅ Most Edits: Just Reload (No Reset Needed)

**For 99% of your edits, you only need to reload:**

1. **Shake your device** (or Cmd+D on simulator)
2. **Tap "Reload"**
3. Done! ✅

**This works for:**
- Style changes
- Text changes
- Component updates
- Most code changes

## 🔄 When Hot Reload Should Work Automatically

If Metro bundler shows "Bundling..." when you save a file, hot reload should work automatically. You should see changes within 1-2 seconds without any action.

**Check Metro terminal** - if you see "Bundling..." after saving, hot reload is working.

## ⚠️ When You Need to Reload (Not Reset)

If changes don't appear automatically:

1. **First try: Shake device → Reload**
   - This reloads the app without clearing cache
   - Takes 5-10 seconds
   - Works 90% of the time

2. **If that doesn't work: Close and reopen Expo Go**
   - Close Expo Go completely
   - Reopen it
   - Scan QR code again
   - This is still just a reload, not a reset

## 🚨 Only Reset When:

You should **rarely** need to reset. Only do this if:
- App crashes and won't start
- You see persistent errors that won't go away
- You've changed native dependencies
- Nothing else works

**To reset:**
```bash
npm run dev:clear
```

## 📋 Quick Reference

| Situation | Action | Time |
|-----------|--------|------|
| Made an edit | Wait 1-2 sec (auto reload) | Instant |
| Change didn't appear | Shake → Reload | 5-10 sec |
| Still not working | Close/reopen Expo Go | 10-15 sec |
| App broken/crashed | `npm run dev:clear` | 30-60 sec |

## 💡 Pro Tips

1. **Watch the Metro terminal** - if it shows "Bundling..." when you save, hot reload is working
2. **Save files properly** - make sure your editor actually saves (check the save indicator)
3. **Fix errors immediately** - TypeScript/JavaScript errors can block hot reload
4. **One change at a time** - make small changes and test, don't make 10 changes at once

## 🎯 Bottom Line

**You should NOT need to reset after every edit.**

- Most edits: Auto hot reload (1-2 sec)
- If not: Shake → Reload (5-10 sec)
- Rarely: Reset only when app is broken

The current setup with tunnel mode should make hot reload more reliable. If you're still having to reset frequently, there might be a deeper issue we need to investigate.














