# Development Setup - Hot Reload Configuration

## ✅ Permanent Fixes Applied

This setup ensures hot reload works reliably every time you start development.

### 1. Metro Bundler Configuration
- ✅ File watching enabled (`watchFolders`, `watcher` config)
- ✅ Fast Refresh enabled
- ✅ No automatic cache clearing (only when needed)
- ✅ Proper file extension watching (tsx, ts, jsx, js, json)

### 2. Package Scripts
- ✅ `npm run dev` - Normal development (hot reload enabled)
- ✅ `npm run dev:clear` - Clear cache when needed
- ✅ `npm run dev:reset` - Full reset (clears .expo and cache)
- ✅ `npm run check:hot-reload` - Verify configuration

### 3. Watchman Configuration
- ✅ `.watchmanconfig` file created for better file watching (macOS)

## 🚀 How to Start Development

### Normal Development (Recommended)
```bash
cd mobile
npm run dev
```

This starts Expo with hot reload enabled. Changes should appear automatically.

### When Hot Reload Stops Working

1. **First, try reloading in Expo Go:**
   - Shake device → "Reload"
   - Or press `r` in the Metro bundler terminal

2. **If that doesn't work, clear cache:**
   ```bash
   npm run dev:clear
   ```

3. **For a full reset (rarely needed):**
   ```bash
   npm run dev:reset
   ```

## 🔍 Verify Your Setup

Run the health check:
```bash
npm run check:hot-reload
```

This will verify:
- Metro config is correct
- Dev script doesn't clear cache by default
- Required config files exist

## 📱 Expo Go Settings

Make sure Fast Refresh is enabled in Expo Go:
1. Shake your device
2. Tap "Settings"
3. Ensure "Fast Refresh" is ON

## 🐛 Troubleshooting

### Hot Reload Not Working?

1. **Check Metro bundler output:**
   - Look for "Bundling..." when you save files
   - Check for any errors in the terminal

2. **Verify file watching:**
   - Make sure files are being saved
   - Check if Metro shows file change notifications

3. **Check for errors:**
   - TypeScript errors can block hot reload
   - Fix any compilation errors first

4. **Restart Metro bundler:**
   ```bash
   # Stop current process (Ctrl+C)
   npm run dev
   ```

5. **Check Expo Go connection:**
   - Make sure device is on same network
   - Try reloading the app manually

### Common Issues

**Issue:** Changes not appearing
- **Solution:** Check Metro bundler for errors, reload app

**Issue:** "Fast Refresh" not available
- **Solution:** Make sure you're using Expo Go (not a standalone build)

**Issue:** File changes not detected
- **Solution:** Run `npm run check:hot-reload` to verify setup

**Issue:** Cache issues
- **Solution:** Use `npm run dev:clear` or `npm run dev:reset`

## 📝 Best Practices

1. **Always use `npm run dev`** for normal development
2. **Only use `--clear` when necessary** (when cache is corrupted)
3. **Keep Metro bundler running** - don't restart unless needed
4. **Fix errors immediately** - they can block hot reload
5. **Save files properly** - ensure your editor is actually saving

## 🔄 What Changed

### Before (Problems):
- ❌ `dev` script used `--clear` flag (broke hot reload)
- ❌ No file watching configuration
- ❌ Cache cleared on every start

### After (Fixed):
- ✅ `dev` script doesn't clear cache
- ✅ Proper file watching configured
- ✅ Fast Refresh enabled
- ✅ Watchman support added
- ✅ Health check script available

## 🎯 Quick Reference

| Command | When to Use |
|---------|-------------|
| `npm run dev` | Normal development (use this 99% of the time) |
| `npm run dev:clear` | When hot reload stops working |
| `npm run dev:reset` | When you have persistent cache issues |
| `npm run check:hot-reload` | Verify your setup is correct |

---

**Note:** Hot reload should now work automatically. You should rarely need to manually reload or clear cache.














