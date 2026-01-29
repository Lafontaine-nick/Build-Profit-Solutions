# 🛡️ Build Profit Solutions - Prevention Guide

## 🚀 Daily Development Workflow

### Start Your App (Never Wrong Directory Again):
```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
./start-app.sh
```

### When Things Go Wrong:
```bash
./clear-cache.sh
./start-app.sh
```

## 🔍 Code Quality Checks

### Before Committing Code:
```bash
npm run lint        # Check for syntax errors
npm run lint:fix    # Auto-fix syntax errors  
npm run type-check  # Check TypeScript errors
npm run format      # Format code
```

## 📋 Available Scripts

- `npm start` - Start everything (backend + mobile)
- `npm run dev` - Start mobile only
- `npm run dev:web` - Start web version
- `npm run dev:tunnel` - Start with tunnel (for mobile)
- `npm run clear` - Clear all caches
- `npm run lint` - Check code quality
- `npm run lint:fix` - Auto-fix code issues
- `npm run type-check` - Check TypeScript
- `npm run format` - Format code

## 🎯 Prevention Rules

1. **Always use `./start-app.sh`** - Never run expo from wrong directory
2. **Run `./clear-cache.sh`** - When you have any issues
3. **Use `npm run lint`** - Before committing code
4. **Backup files** - Before major changes: `cp file.js file.js.backup`
5. **Use version control** - `git add . && git commit -m "message"`

## 🚨 Emergency Fixes

### If you get syntax errors:
```bash
./clear-cache.sh
npm run lint:fix
./start-app.sh
```

### If you get authentication errors:
```bash
./clear-cache.sh
# Check .env.local file
./start-app.sh
```

### If you get directory errors:
```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
./start-app.sh
```

## 📱 Quick Access

- **Web:** http://localhost:8081
- **Backend API:** http://localhost:3001
- **Mobile:** Scan QR code with Expo Go

---
**Remember: Always use the scripts - they prevent all the issues we just fixed!**
