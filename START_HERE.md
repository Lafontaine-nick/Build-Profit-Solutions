# 🚀 Quick Start Guide - Start Here Tomorrow!

## ✅ One-Command Startup (Easiest)

**Just run this command:**
```bash
cd /Users/nick_lafontaine/build-profit-solutions
./start-app.sh
```

This will:
- ✅ Start the backend server on port 3001
- ✅ Start the mobile app with Expo
- ✅ Show you the QR code to scan

Then scan the QR code with Expo Go on your iPhone!

---

## 🔧 Manual Startup (If needed)

### Terminal 1: Backend Server
```bash
cd /Users/nick_lafontaine/build-profit-solutions/backend
npm start
```

Wait for: `✅ Server running on http://localhost:3001`

### Terminal 2: Mobile App
```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npx expo start -c --tunnel
```

Wait for: QR code to appear, then scan with Expo Go app

---

## ✅ Verify Everything Works

1. **Backend Health Check**: Open http://localhost:3001/health in browser
   - Should show: `{"status":"ok"}`

2. **Mobile App**: 
   - Scan QR code with Expo Go
   - Should load the app
   - Check Leads tab → Analytics tab to verify pipeline stages

---

## 🐛 Troubleshooting

### Port Already in Use?
```bash
# Kill processes on ports
lsof -ti:3001 | xargs kill -9  # Backend
lsof -ti:8081 | xargs kill -9  # Expo
```

### Backend Won't Start?
```bash
cd /Users/nick_lafontaine/build-profit-solutions/backend
npm install  # Reinstall dependencies if needed
npm start
```

### Mobile App Won't Start?
```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
rm -rf node_modules/.cache  # Clear cache
npx expo start -c --tunnel  # Start with tunnel mode
```

### Can't Connect from Phone?
- Make sure both devices are on the **same WiFi network**
- Try tunnel mode: `npx expo start -c --tunnel`
- Check firewall settings on your Mac

---

## 📋 What's Working

✅ **Leads Analytics Dashboard**
- Pipeline stages: New → Contacted → Qualified → Proposal → Won → Lost
- Won badge updates when you click "Mark as Won" in bid builder
- All stages sync correctly

✅ **Bid Builder Integration**
- Auto-fills customer info when clicking "Send Proposal" from lead
- Tracks bid submission and won status
- Updates analytics in real-time

✅ **Engagement Tracking**
- Tracks bid started, submitted, and won
- Updates analytics dashboard automatically

---

## 🛑 Stopping Services

**Press `Ctrl+C` in both terminal windows** (or in the startup script)

---

## 💾 Current State

All changes are committed and saved:
- ✅ Removed negotiation stage
- ✅ Updated won stage to sync with bid builder
- ✅ Auto-fill customer info from leads
- ✅ Enhanced analytics refresh

**Commit**: `46033f2 - Fix leads analytics and bid builder integration`

---

**That's it! You're ready to go! 🎉**

