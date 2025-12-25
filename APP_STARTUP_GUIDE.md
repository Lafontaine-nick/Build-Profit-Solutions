# 🚀 App Startup Guide - Quick Fix

## Current Status

✅ **Backend Running**: Port 3001 (http://192.168.0.201:3001)  
✅ **AI Backend Running**: Port 3000 (http://192.168.0.201:3000)  
⚠️ **Expo**: Starting... (needs QR code visible)

## How to Start Your App

### Option 1: Use the Startup Script (Easiest)
```bash
cd /Users/nick_lafontaine/build-profit-solutions
./start-app.sh
```

### Option 2: Manual Start (See QR Code)

**Terminal 1 - Backend (if not running):**
```bash
cd /Users/nick_lafontaine/build-profit-solutions/backend
npm start
```

**Terminal 2 - AI Backend (if not running):**
```bash
cd /Users/nick_lafontaine/build-profit-solutions/bps-ai-backend
npm run dev
```

**Terminal 3 - Mobile App (MUST SEE OUTPUT):**
```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npx expo start --tunnel
```

**Wait for:**
- QR code to appear in terminal
- Tunnel URL to show (e.g., `exp://192.168.0.201:8081`)

## Scan QR Code

1. **Open Expo Go app** on your iPhone
2. **Tap "Scan QR Code"**
3. **Point camera at QR code** in terminal
4. **Wait for app to load**

## If App Still Won't Open

### Check Network Connection
- Make sure iPhone and Mac are on **same WiFi network**
- Your Mac's IP: `192.168.0.201` (verified ✅)

### Check Services
```bash
# Check if backend is running
curl http://localhost:3001/health

# Check if AI backend is running  
curl http://localhost:3000

# Check if Expo is running
lsof -ti:8081
```

### Restart Everything
```bash
# Stop all services
pkill -9 -f "expo start"
pkill -9 -f "node.*server"
pkill -9 -f "ts-node"

# Then start fresh (see Option 2 above)
```

## Troubleshooting

### "Network request failed" Error
- Backend might not be running
- Check: `curl http://localhost:3001/health`
- If fails, start backend: `cd backend && npm start`

### "Unable to connect" Error
- Check WiFi - both devices on same network
- Try tunnel mode: `npx expo start --tunnel`
- Check firewall settings

### QR Code Not Showing
- Run Expo in a **new terminal window** (not background)
- Use: `cd mobile && npx expo start --tunnel`
- Make sure terminal window is visible

## Current Configuration

- **Backend URL**: `http://192.168.0.201:3001/api` ✅
- **AI Backend URL**: `http://192.168.0.201:3000` ✅
- **Network IP**: `192.168.0.201` ✅
- **Expo Mode**: Tunnel (for remote access)

---

**Next Step**: Open a new terminal, run `cd mobile && npx expo start --tunnel`, and scan the QR code with Expo Go!





