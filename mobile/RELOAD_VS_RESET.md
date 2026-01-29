# Reload vs Reset - Quick Guide

## ✅ Normal Workflow (No Reset Needed)

**For almost all edits, just reload:**

1. Make your edit
2. Save the file
3. **Shake device → Tap "Reload"**
4. Wait 5-10 seconds
5. Done! ✅

**You should NOT need to reset for:**
- Style changes
- Text changes  
- Component updates
- Most code changes

## 🔄 When to Just Reload

**Reload (shake device → reload) when:**
- Changes don't appear automatically
- App is working but showing old code
- You want to see your latest changes

**This takes 5-10 seconds and works 90% of the time.**

## 🚨 Only Reset When:

**Reset (`npm run dev:clear`) ONLY when:**
- App crashes and won't start
- You see persistent errors
- You've changed package.json dependencies
- Reload doesn't work after multiple tries

**This takes 30-60 seconds and should be rare.**

## 📊 Quick Decision Tree

```
Made an edit?
├─ Change appears automatically? → ✅ Done!
└─ Change doesn't appear?
   ├─ Shake → Reload → ✅ Usually works!
   └─ Still not working?
      ├─ Close/reopen Expo Go → ✅ Try this first
      └─ Still broken? → 🚨 Reset (rare)
```

## 💡 Pro Tips

1. **Watch Metro terminal** - If you see "Bundling..." when you save, hot reload is working
2. **Save properly** - Make sure your editor actually saves
3. **Fix errors first** - TypeScript errors can block hot reload
4. **One change at a time** - Test small changes before making many

## 🎯 Bottom Line

**You should NOT reset after every edit.**

- Most edits: Auto hot reload (instant)
- If not: Shake → Reload (5-10 sec)  
- Rarely: Reset only when broken

Your current setup is optimized. Just use reload for normal edits, and only reset when absolutely necessary.














