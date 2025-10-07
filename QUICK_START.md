# 🏗️ Build Profit Solutions - Quick Start Guide

## 🚀 Easy Startup (Recommended)

### Option 1: One-Command Startup
```bash
cd /Users/nick_lafontaine/build-profit-solutions
./start-app.sh
```

This script will:
- ✅ Start the backend server on port 3001
- ✅ Start the mobile app in LAN mode
- ✅ Verify both services are working
- ✅ Show you the QR code to scan

### Option 2: Manual Startup

#### 1. Start Backend Server
```bash
cd /Users/nick_lafontaine/build-profit-solutions/backend
npm start
```

#### 2. Start Mobile App (in new terminal)
```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npx expo start --lan
```

## 📱 How to Use the App

1. **Scan QR Code**: Use Expo Go app on your iPhone
2. **Make sure you're on the same WiFi** as your Mac
3. **SKU Search**: Search for construction materials at Home Depot

## 🔧 Troubleshooting

### If SKU Search isn't working:
1. **Check backend**: Visit http://localhost:3001/health
2. **Check network**: Make sure iPhone and Mac are on same WiFi
3. **Restart services**: Stop both and run `./start-app.sh` again

### If you see "Network request failed":
- Backend server isn't running
- Wrong network configuration
- Try restarting both services

## 📊 Service URLs

- **Backend Health**: http://localhost:3001/health
- **Backend API**: http://localhost:3001/api
- **Mobile App**: Scan QR code with Expo Go
- **Network IP**: http://192.168.0.201:3001 (for mobile)

## 🎯 What's Working

- ✅ SKU Search (Home Depot products)
- ✅ Real-time pricing
- ✅ Product links
- ✅ Mobile app on iPhone
- ✅ Backend API

## 🛑 Stopping Services

- **Automatic**: Press Ctrl+C in the startup script
- **Manual**: Stop both terminal windows or kill processes

---

**Next time you want to use the app, just run:**
```bash
./start-app.sh
```