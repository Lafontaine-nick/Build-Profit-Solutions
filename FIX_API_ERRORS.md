# 🔧 Fix API Errors - Quick Guide

## The Problem
You're getting "Network request failed" errors because the backend server isn't running.

## ✅ Solution: Start the Backend

### Option 1: Use the Start Script (Easiest)
```bash
cd /Users/nick_lafontaine/build-profit-solutions
./start-backend.sh
```

### Option 2: Manual Start
```bash
cd /Users/nick_lafontaine/build-profit-solutions/backend
npm start
```

### Option 3: Development Mode (Auto-restart on changes)
```bash
cd /Users/nick_lafontaine/build-profit-solutions/backend
npm run dev
```

## ✅ Verify Backend is Running

After starting, test it:
```bash
curl http://192.168.0.201:3001/health
```

You should see: `{"status":"OK",...}`

## 🚀 Running Both Servers

You need **TWO terminals**:

**Terminal 1 - Backend:**
```bash
cd /Users/nick_lafontaine/build-profit-solutions/backend && npm start
```

**Terminal 2 - Mobile App:**
```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile && npm start
```

## 🔍 Check What's Happening

### See if backend is running:
```bash
lsof -i :3001
```

### Check backend logs:
Look at Terminal 1 where backend is running. You should see:
```
✅ Database initialization attempted
Server running on port 3001
```

### Check mobile app logs:
Look for these in your Expo console:
```
🌐 ApiService making request to: http://192.168.0.201:3001/api/...
🌐 ApiService baseUrl: http://192.168.0.201:3001
```

## ⚠️ Common Issues

### Issue 1: Port Already in Use
If you see "Port 3001 already in use":
```bash
# Find what's using the port
lsof -i :3001

# Kill it (replace PID with the number from above)
kill -9 <PID>
```

### Issue 2: Wrong IP Address
If your network IP changed:
```bash
# Find your current IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Update mobile/app.config.js with the new IP
```

### Issue 3: Backend Dependencies Missing
```bash
cd /Users/nick_lafontaine/build-profit-solutions/backend
npm install
```

### Issue 4: Environment Variables Missing
```bash
cd /Users/nick_lafontaine/build-profit-solutions/backend
# Copy example env file
cp env.example .env
# Edit .env with your API keys
```

## 🎯 Quick Test

Once backend is running, test these endpoints:
```bash
# Health check
curl http://192.168.0.201:3001/health

# Should return: {"status":"OK","timestamp":"...","version":"1.0.0"}
```

## 📱 After Starting Backend

1. **Reload your mobile app** (shake device → Reload, or press `r` in Expo)
2. **Check the console** - errors should disappear
3. **Test a feature** - try loading the dashboard or leads

---

**Still having issues?** Check the backend terminal for error messages and share them.







