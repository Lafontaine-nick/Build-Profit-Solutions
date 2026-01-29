# 🌐 Network Troubleshooting Guide

## The Problem
Mobile simulators (iOS/Android) cannot reach `localhost` when running locally. This causes "Network request failed" errors when trying to connect to your backend server.

## The Solution
We've implemented smart API configuration that automatically detects the correct backend URL based on platform and environment.

## How It Works

### Automatic Detection
The app now automatically detects:
- **Web Browser**: Uses `http://localhost:3001` ✅
- **iOS Simulator**: Uses `http://192.168.0.201:3001` ✅
- **Android Emulator**: Uses `http://10.0.2.2:3001` ✅
- **Physical Devices**: Uses `http://192.168.0.201:3001` ✅
- **Production**: Uses deployed backend URL ✅

### Files Modified
- `utils/apiConfig.ts` - Smart API URL detection
- `utils/networkDetection.ts` - Network environment detection
- `components/AttachSkuModal.tsx` - Updated to use smart configuration
- `scripts/start-dev.sh` - Development startup script

## Quick Fixes

### If SKU Search Still Fails:

1. **Check Backend Status**:
   ```bash
   curl http://192.168.0.201:3001/health
   ```

2. **Restart with Development Script**:
   ```bash
   cd mobile
   ./scripts/start-dev.sh
   ```

3. **Manual Network Check**:
   ```bash
   # Find your network IP
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Update the IP in utils/networkDetection.ts if needed
   ```

### For Different Network IPs:
If your network IP is different from `192.168.0.201`, update it in:
- `mobile/utils/networkDetection.ts` (line with `recommendedApiUrl`)
- `mobile/app.config.js` (line with `apiBaseUrl`)

## Development Workflow

### Recommended Startup:
```bash
# Terminal 1: Start Backend
cd backend
node src/server.js

# Terminal 2: Start Mobile App
cd mobile
./scripts/start-dev.sh
```

### Alternative Startup:
```bash
# Start without tunnel for local development
cd mobile
npx expo start -c
```

## Debug Information
The app now logs detailed network configuration:
```
🌐 Network Configuration: {
  platform: "ios",
  isSimulator: true,
  isLocalhost: false,
  recommendedUrl: "http://192.168.0.201:3001",
  isDevelopment: true,
  isDevice: false
}
```

## Prevention Tips

1. **Always use the development script**: `./scripts/start-dev.sh`
2. **Check network logs**: Look for the 🌐 Network Configuration logs
3. **Verify backend accessibility**: Ensure `http://192.168.0.201:3001/health` returns 200
4. **Update network IP**: If you change networks, update the IP in configuration files

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Network request failed | Wrong API URL | Check network logs, update IP |
| Backend not accessible | Backend not running | Start backend server |
| Web works, mobile fails | Platform detection | Check platform-specific URL |
| Simulator vs Device | Different network needs | Verify device vs simulator detection |

---

**Last Updated**: October 2024  
**Network IP**: 192.168.0.201 (update if your network changes)


