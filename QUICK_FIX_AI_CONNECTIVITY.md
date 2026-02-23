# Quick Fix: AI Assistant Connectivity Issues

## What Was Fixed

### 1. **Error Messages** ✅
- Fixed port number: Changed from 3000 → **3001** (correct backend port)
- Fixed backend path: Changed from `bps-ai-backend` → `backend` (correct directory)
- Added helpful instructions with actual commands
- Added backend health check URL

### 2. **Network Detection** ✅
- Improved iOS Simulator detection (checks `isDevice === false || undefined`)
- Added priority ordering: Simulator → Config → Fallback
- Added logging to show which URL is being used

### 3. **Timeout Handling** ✅
- Reduced timeout from 30s → **15s** for faster feedback
- Improved error messages for timeout vs network failure
- Added specific instructions for each error type

### 4. **Error Consistency** ✅
- Standardized error messages across all error paths
- Added actionable steps for users
- Included backend URL in error messages for debugging

## How to Test

1. **Start Backend**:
   ```bash
   cd backend
   npm start
   ```

2. **Check Backend Health**:
   ```bash
   curl http://localhost:3001/health
   ```

3. **Reload App**:
   - Press `Cmd + R` in iOS Simulator
   - Or restart Expo: `npx expo start --clear`

4. **Test AI Assistant**:
   - Open AI Assistant tab
   - Send a message
   - Should connect to `http://localhost:3001` (for simulator)
   - Check console logs for connection URL

## Expected Behavior

### iOS Simulator:
- Console shows: `📱 iOS Simulator detected - using localhost:3001`
- Connects to: `http://localhost:3001/api/ai-assistant`

### Physical Device:
- Connects to: `http://192.168.x.x:3001/api/ai-assistant` (your network IP)

### If Backend is Down:
- Clear error message with instructions
- Shows correct port (3001) and path (backend/)
- Includes health check URL

## Troubleshooting

### Still seeing "port 3000" error?
- **Reload the app** - old code might be cached
- Press `Cmd + R` in simulator or restart Expo

### Still connecting to wrong IP?
- Check console logs for: `🤖 AI Assistant connecting to:`
- Verify `Constants.isDevice` value in logs
- For simulator, should show `isDevice: false` or `undefined`

### Backend not responding?
1. Check if backend is running: `lsof -i :3001`
2. Test health endpoint: `curl http://localhost:3001/health`
3. Check backend logs for errors
4. Restart backend: `cd backend && npm start`
