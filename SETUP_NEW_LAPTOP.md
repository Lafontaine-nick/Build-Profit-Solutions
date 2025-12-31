# 🚀 Quick Setup Guide - New Laptop

Get your app running on a new laptop in 10 minutes.

## ✅ Prerequisites (Install These First)

1. **Node.js** (v18+) - https://nodejs.org/
2. **Git** - Usually pre-installed on macOS
3. **Cursor IDE** - https://cursor.sh/
4. **Expo Go app** - Install on your phone (App Store / Google Play)

---

## 📥 Step 1: Clone Your Code

```bash
# Navigate to where you want the project
cd ~/Documents

# Clone from GitHub
git clone https://github.com/Lafontaine-nick/Build-Profit-Solutions.git

# Go into the project
cd Build-Profit-Solutions

# IMPORTANT: Initialize the mobile submodule
git submodule update --init --recursive
```

---

## 📦 Step 2: Install Dependencies

### Backend
```bash
cd backend
npm install
cd ..
```
⏱️ Wait 2-5 minutes

### Mobile App
```bash
cd mobile
npm install
cd ..
```
⏱️ Wait 3-7 minutes

---

## 🔐 Step 3: Set Up Environment Variables

```bash
cd backend
cp env.example .env
```

Then edit `backend/.env` and add:
- `OPENAI_API_KEY=your_key_here` (if you have one)
- `JWT_SECRET=any_random_string` (generate one with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

---

## 🚀 Step 4: Start the App

### Terminal 1 - Backend:
```bash
cd backend
npm run dev
```
✅ You should see: "Server running on port 3001"

### Terminal 2 - Mobile App:
```bash
cd mobile
npm run dev:lan
```
✅ You should see a QR code

---

## 📱 Step 5: Connect Your Phone

1. Make sure phone and laptop are on **same WiFi network**
2. Open **Expo Go** app on your phone
3. Scan the QR code from Terminal 2
4. Wait for app to load (30-60 seconds first time)

---

## 💻 Step 6: Open in Cursor

1. Open Cursor IDE
2. **File → Open Folder**
3. Select: `~/Documents/Build-Profit-Solutions`
4. Wait for indexing to finish

---

## ✅ You're Done!

Your app is now running exactly where you left off:
- ✅ All your code is synced from GitHub
- ✅ Backend running on port 3001
- ✅ Mobile app ready on your phone
- ✅ Cursor IDE ready for editing

---

## 🆘 Quick Troubleshooting

**Port 3001 in use?**
```bash
lsof -i :3001
kill -9 <PID>
```

**Can't connect phone?**
- Make sure same WiFi network
- Try: `cd mobile && npm run dev:tunnel` (uses tunnel mode)

**Dependencies won't install?**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Mobile submodule issues?**
```bash
cd mobile
git pull origin main
cd ..
git add mobile
git commit -m "Update mobile submodule"
```

---

## 📚 More Detailed Guides

- `NEW_COMPUTER_SETUP.md` - Comprehensive setup guide
- `STEP_BY_STEP_SETUP.md` - Detailed step-by-step instructions
- `QUICK_START_NEW_COMPUTER.md` - Quick reference

---

**Repository**: https://github.com/Lafontaine-nick/Build-Profit-Solutions.git


