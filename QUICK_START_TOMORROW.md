# 🚀 Quick Start Guide - Tomorrow

## Step 1: Open Project in Cursor
1. Open Cursor IDE
2. File → Open Folder
3. Select: `~/Documents/Build-Profit-Solutions`
4. Wait for indexing (1-2 minutes)

## Step 2: Start Backend Server
Open Terminal and run:
```bash
cd ~/Documents/Build-Profit-Solutions/backend
npm run dev
```
✅ You should see: "Server running on port 3001"
**Leave this terminal open!**

## Step 3: Start Mobile App (New Terminal)
Open a NEW Terminal window/tab and run:
```bash
cd ~/Documents/Build-Profit-Solutions/mobile
npm run dev:lan
```
✅ You should see: Metro bundler starting and a QR code
**Leave this terminal open too!**

## Step 4: Connect Your Phone
1. Make sure phone and laptop are on the same WiFi
2. Open Expo Go app on your phone
3. Scan the QR code from Terminal 2
4. App will load on your phone

## Step 5: Show QR Code (if needed)
If you need to see the QR code again:
```bash
cd ~/Documents/Build-Profit-Solutions
bash show-qr-code.sh
```

## ✅ Verify Everything Works
- Backend: Open http://localhost:3001/health (should show {"status":"OK"})
- Mobile: App should be running on your phone

## 📝 Quick Commands Reference
```bash
# Start backend
cd ~/Documents/Build-Profit-Solutions/backend && npm run dev

# Start mobile
cd ~/Documents/Build-Profit-Solutions/mobile && npm run dev:lan

# Show QR code
cd ~/Documents/Build-Profit-Solutions && bash show-qr-code.sh

# Check if backend is running
curl http://localhost:3001/health
```

## 🆘 Troubleshooting
- **Port 3001 in use?** Kill it: `lsof -ti:3001 | xargs kill`
- **Can't scan QR?** Make sure same WiFi, or try tunnel mode: `npm run dev:tunnel`
- **Backend won't start?** Check `.env` file exists in `backend/` folder

---
**That's it! Your app should be running in ~2 minutes! 🎉**
