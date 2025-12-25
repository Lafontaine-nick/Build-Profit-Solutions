# 🚀 Quick Start Commands

## To Start Your App Tomorrow:

### Option 1: Start Everything (Recommended)

**Terminal 1 - Backend:**
```bash
cd /Users/nick_lafontaine/build-profit-solutions
./start-backend.sh
```

**Terminal 2 - Mobile App (LAN Mode):**
```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npm run dev:lan
```

---

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd /Users/nick_lafontaine/build-profit-solutions/backend
npm start
```

**Terminal 2 - Mobile App (LAN Mode):**
```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npm run dev:lan
```

---

## 📱 What Happens:

1. **Backend** starts on `http://localhost:3001`
   - Health check: `http://localhost:3001/health`
   - API: `http://localhost:3001/api`

2. **Mobile App** starts Expo Dev Server
   - Opens in browser automatically
   - Scan QR code with Expo Go app (iOS/Android)
   - Or press `i` for iOS simulator / `a` for Android emulator

---

## ✅ Quick Health Check:

After starting, verify everything is working:
```bash
# Check backend is running
curl http://localhost:3001/health

# Should return: {"status":"ok"}
```

---

## 🛑 To Stop:

- Press `Ctrl+C` in each terminal window
- Or close the terminal windows

---

## 📝 Notes:

- Backend runs on port **3001**
- Mobile app uses **LAN mode** for local network connection
- Make sure you're in the correct directories before running commands
